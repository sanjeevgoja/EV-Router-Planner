import type { FastifyInstance } from "fastify";
import { query } from "../db.js";
import type { StationAlongRoute, VehicleType } from "@ev-router/shared";

interface AlongRouteBody {
  geometry: GeoJSON.LineString;
  bufferMeters?: number;
  vehicleType: VehicleType;
}

const FUEL_TYPE_FOR: Record<VehicleType, string> = {
  gasoline: "regular",
  diesel: "diesel",
  ev: "ev_kwh",
};

const KIND_FOR: Record<VehicleType, "fuel" | "ev_charging"> = {
  gasoline: "fuel",
  diesel: "fuel",
  ev: "ev_charging",
};

interface StationRow {
  id: number;
  source: string;
  external_id: string;
  kind: string;
  name: string | null;
  brand: string | null;
  fuel_types: string[];
  connector_types: string[];
  network: string | null;
  address: string | null;
  country: string | null;
  region: string | null;
  lon: number;
  lat: number;
  updated_at: string;
  distance_m: number;
  price: string | null;
  currency: string | null;
  unit: string | null;
  price_source: string | null;
  granularity: string | null;
  recorded_at: string | null;
}

function rowToStation(r: StationRow, queriedFuelType: string): StationAlongRoute {
  return {
    id: r.id,
    source: r.source,
    externalId: r.external_id,
    kind: r.kind as StationAlongRoute["kind"],
    name: r.name,
    brand: r.brand,
    fuelTypes: r.fuel_types as StationAlongRoute["fuelTypes"],
    connectorTypes: r.connector_types,
    network: r.network,
    address: r.address,
    country: r.country,
    region: r.region,
    lon: r.lon,
    lat: r.lat,
    updatedAt: r.updated_at,
    distanceFromRouteMeters: r.distance_m,
    prices:
      r.price != null
        ? [
            {
              fuelType: queriedFuelType as StationAlongRoute["fuelTypes"][number],
              price: Number(r.price),
              currency: r.currency ?? "",
              unit: r.unit ?? "",
              source: r.price_source ?? "",
              granularity: (r.granularity as any) ?? "station",
              recordedAt: r.recorded_at ?? "",
            },
          ]
        : [],
  };
}

export async function stationsRoutes(app: FastifyInstance) {
  app.post("/api/stations/along-route", async (req, reply) => {
    const body = req.body as AlongRouteBody;
    if (!body?.geometry?.coordinates?.length) {
      return reply.code(400).send({ error: "missing 'geometry' (GeoJSON LineString)" });
    }
    const bufferMeters = body.bufferMeters ?? 5000;
    const kind = KIND_FOR[body.vehicleType];
    const fuelType = FUEL_TYPE_FOR[body.vehicleType];
    const geojson = JSON.stringify(body.geometry);

    const result = await query<StationRow>(
      `WITH route AS (
         SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography AS geog
       )
       SELECT
         s.id, s.source, s.external_id, s.kind, s.name, s.brand,
         s.fuel_types, s.connector_types, s.network, s.address,
         s.country, s.region,
         ST_X(s.geom::geometry) AS lon, ST_Y(s.geom::geometry) AS lat,
         s.updated_at,
         ST_Distance(s.geom, route.geog) AS distance_m,
         COALESCE(lp.price, rp.price) AS price,
         COALESCE(lp.currency, rp.currency) AS currency,
         COALESCE(lp.unit, rp.unit) AS unit,
         COALESCE(lp.source, rp.source) AS price_source,
         CASE WHEN lp.price IS NOT NULL THEN 'station' ELSE 'regional_average' END AS granularity,
         COALESCE(lp.recorded_at, rp.recorded_at) AS recorded_at
       FROM stations s, route
       LEFT JOIN latest_station_prices lp
         ON lp.station_id = s.id AND lp.fuel_type = $3
       LEFT JOIN latest_regional_fuel_prices rp
         ON rp.country = s.country AND rp.region = s.region AND rp.fuel_type = $3
       WHERE s.kind = $2
         AND ST_DWithin(s.geom, route.geog, $4)
       ORDER BY COALESCE(lp.price, rp.price) ASC NULLS LAST, distance_m ASC
       LIMIT 100`,
      [geojson, kind, fuelType, bufferMeters]
    );

    return { stations: result.rows.map((r) => rowToStation(r, fuelType)) };
  });

  app.get("/api/stations/cheapest", async (req, reply) => {
    const q = req.query as Record<string, string>;
    const { lon, lat, vehicleType } = q;
    if (!lon || !lat || !vehicleType) {
      return reply
        .code(400)
        .send({ error: "missing query params 'lon', 'lat', 'vehicleType'" });
    }
    const radiusMeters = Number(q.radiusMeters ?? 20000);
    const kind = KIND_FOR[vehicleType as VehicleType];
    const fuelType = FUEL_TYPE_FOR[vehicleType as VehicleType];
    const limit = Math.min(Number(q.limit ?? 20), 100);

    const result = await query<StationRow>(
      `WITH origin AS (
         SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS geog
       )
       SELECT
         s.id, s.source, s.external_id, s.kind, s.name, s.brand,
         s.fuel_types, s.connector_types, s.network, s.address,
         s.country, s.region,
         ST_X(s.geom::geometry) AS lon, ST_Y(s.geom::geometry) AS lat,
         s.updated_at,
         ST_Distance(s.geom, origin.geog) AS distance_m,
         COALESCE(lp.price, rp.price) AS price,
         COALESCE(lp.currency, rp.currency) AS currency,
         COALESCE(lp.unit, rp.unit) AS unit,
         COALESCE(lp.source, rp.source) AS price_source,
         CASE WHEN lp.price IS NOT NULL THEN 'station' ELSE 'regional_average' END AS granularity,
         COALESCE(lp.recorded_at, rp.recorded_at) AS recorded_at
       FROM stations s, origin
       LEFT JOIN latest_station_prices lp
         ON lp.station_id = s.id AND lp.fuel_type = $5
       LEFT JOIN latest_regional_fuel_prices rp
         ON rp.country = s.country AND rp.region = s.region AND rp.fuel_type = $5
       WHERE s.kind = $4
         AND ST_DWithin(s.geom, origin.geog, $3)
       ORDER BY COALESCE(lp.price, rp.price) ASC NULLS LAST, distance_m ASC
       LIMIT $6`,
      [Number(lon), Number(lat), radiusMeters, kind, fuelType, limit]
    );

    return { stations: result.rows.map((r) => rowToStation(r, fuelType)) };
  });
}
