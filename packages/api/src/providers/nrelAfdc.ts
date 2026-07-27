import { request } from "undici";
import { config } from "../config.js";
import type { StationProvider, StationRecord } from "./types.js";

// NREL Alternative Fuel Data Center (AFDC) API - free, DEMO_KEY works for
// light use. Covers US/Canada/Mexico EV charging + alt-fuel stations.
// Docs: https://developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/
const AFDC_URL = "https://developer.nrel.gov/api/alt-fuel-stations/v1.json";

// Bounding box for the demo region (Colorado, matches the default Valhalla
// extract). Override via STATION_BBOX="swlon,swlat,nelon,nelat" for other regions.
const DEFAULT_BBOX = "-109.1,36.9,-102.0,41.1";

interface AfdcStation {
  id: number;
  station_name?: string;
  ev_network?: string;
  fuel_type_code: string; // 'ELEC', 'E85', 'LPG', 'CNG', 'HY', 'BD'
  ev_connector_types?: string[];
  street_address?: string;
  city?: string;
  state?: string;
  country?: string;
  longitude: number;
  latitude: number;
}

export class NrelAfdcProvider implements StationProvider {
  readonly name = "nrel_afdc";

  async fetchStations(): Promise<StationRecord[]> {
    const bbox = process.env.STATION_BBOX ?? DEFAULT_BBOX;
    const [swlon, swlat, nelon, nelat] = bbox.split(",").map(Number);

    const url = new URL(AFDC_URL);
    url.searchParams.set("api_key", config.nrelApiKey);
    url.searchParams.set("fuel_type", "ELEC");
    url.searchParams.set("status", "E");
    url.searchParams.set(
      "boundingBox",
      `${nelat},${swlon},${swlat},${nelon}` // NREL expects "topLeftLat,topLeftLng,bottomRightLat,bottomRightLng"
    );
    url.searchParams.set("limit", "all");

    const res = await request(url);
    if (res.statusCode >= 400) {
      throw new Error(`NREL AFDC request failed: HTTP ${res.statusCode}`);
    }
    const body = (await res.body.json()) as { fuel_stations: AfdcStation[] };

    return body.fuel_stations
      .filter((s) => Number.isFinite(s.longitude) && Number.isFinite(s.latitude))
      .map((s) => ({
        source: this.name,
        externalId: String(s.id),
        kind: "ev_charging" as const,
        name: s.station_name ?? null,
        brand: s.ev_network ?? null,
        fuelTypes: ["ev_kwh"],
        connectorTypes: s.ev_connector_types ?? [],
        network: s.ev_network ?? null,
        address: [s.street_address, s.city, s.state].filter(Boolean).join(", "),
        country: s.country ?? "US",
        region: s.state ?? null,
        lon: s.longitude,
        lat: s.latitude,
        raw: s,
      }));
  }
}
