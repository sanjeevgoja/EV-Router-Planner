import { query } from "../db.js";
import type { StationProvider } from "../providers/types.js";

export async function ingestStations(provider: StationProvider): Promise<number> {
  const stations = await provider.fetchStations();

  for (const s of stations) {
    const upsert = await query<{ id: number }>(
      `INSERT INTO stations
         (source, external_id, kind, name, brand, fuel_types, connector_types,
          network, address, country, region, geom, raw, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               ST_SetSRID(ST_MakePoint($12,$13), 4326)::geography, $14, now())
       ON CONFLICT (source, external_id) DO UPDATE SET
         name = EXCLUDED.name,
         brand = EXCLUDED.brand,
         fuel_types = EXCLUDED.fuel_types,
         connector_types = EXCLUDED.connector_types,
         network = EXCLUDED.network,
         address = EXCLUDED.address,
         country = EXCLUDED.country,
         region = EXCLUDED.region,
         geom = EXCLUDED.geom,
         raw = EXCLUDED.raw,
         updated_at = now()
       RETURNING id`,
      [
        s.source,
        s.externalId,
        s.kind,
        s.name,
        s.brand,
        s.fuelTypes,
        s.connectorTypes,
        s.network,
        s.address,
        s.country,
        s.region,
        s.lon,
        s.lat,
        JSON.stringify(s.raw ?? {}),
      ]
    );

    const stationId = upsert.rows[0]?.id;
    if (stationId && s.price && Number.isFinite(s.price.price)) {
      await query(
        `INSERT INTO station_prices
           (station_id, fuel_type, price, currency, unit, source, granularity, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,'station', now())`,
        [
          stationId,
          s.price.fuelType,
          s.price.price,
          s.price.currency,
          s.price.unit,
          provider.name,
        ]
      );
    }
  }

  return stations.length;
}
