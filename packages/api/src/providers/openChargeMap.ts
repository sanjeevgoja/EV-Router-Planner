import { request } from "undici";
import { config } from "../config.js";
import type { StationProvider, StationRecord } from "./types.js";

// Open Charge Map API - free, global EV charging station registry
// (US, Canada, and strong European coverage). No key required for read
// access; a free key raises rate limits. Docs: https://openchargemap.org/site/develop/api
const OCM_URL = "https://api.openchargemap.io/v3/poi";

// Default demo region: Luxembourg (small, fast to demo European coverage).
// Override with STATION_LATLON="lat,lon" + STATION_RADIUS_KM.
const DEFAULT_LATLON = "49.8153,6.1296";
const DEFAULT_RADIUS_KM = 60;

interface OcmConnection {
  ConnectionType?: { Title?: string };
}

interface OcmPoi {
  ID: number;
  AddressInfo?: {
    Title?: string;
    AddressLine1?: string;
    Town?: string;
    Country?: { ISOCode?: string };
    Longitude: number;
    Latitude: number;
  };
  OperatorInfo?: { Title?: string };
  UsageCost?: string;
  Connections?: OcmConnection[];
}

export class OpenChargeMapProvider implements StationProvider {
  readonly name = "open_charge_map";

  async fetchStations(): Promise<StationRecord[]> {
    const [lat, lon] = (process.env.STATION_LATLON ?? DEFAULT_LATLON)
      .split(",")
      .map(Number);
    const radius = Number(process.env.STATION_RADIUS_KM ?? DEFAULT_RADIUS_KM);

    const url = new URL(OCM_URL);
    url.searchParams.set("output", "json");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("distance", String(radius));
    url.searchParams.set("distanceunit", "km");
    url.searchParams.set("maxresults", "500");
    url.searchParams.set("compact", "true");
    if (config.ocmApiKey) url.searchParams.set("key", config.ocmApiKey);

    const res = await request(url);
    if (res.statusCode >= 400) {
      throw new Error(`Open Charge Map request failed: HTTP ${res.statusCode}`);
    }
    const pois = (await res.body.json()) as OcmPoi[];

    return pois
      .filter((p) => p.AddressInfo?.Longitude != null && p.AddressInfo?.Latitude != null)
      .map((p) => ({
        source: this.name,
        externalId: String(p.ID),
        kind: "ev_charging" as const,
        name: p.AddressInfo?.Title ?? null,
        brand: p.OperatorInfo?.Title ?? null,
        fuelTypes: ["ev_kwh"],
        connectorTypes: (p.Connections ?? [])
          .map((c) => c.ConnectionType?.Title)
          .filter((t): t is string => Boolean(t)),
        network: p.OperatorInfo?.Title ?? null,
        address: [p.AddressInfo?.AddressLine1, p.AddressInfo?.Town]
          .filter(Boolean)
          .join(", "),
        country: p.AddressInfo?.Country?.ISOCode ?? null,
        region: null,
        lon: p.AddressInfo!.Longitude,
        lat: p.AddressInfo!.Latitude,
        raw: p,
        price: p.UsageCost
          ? {
              fuelType: "ev_session",
              price: NaN, // UsageCost is free text (e.g. "0.35 EUR/kWh"); parsed opportunistically below
              currency: "",
              unit: "session",
            }
          : undefined,
      }))
      .map((s) => {
        // Best-effort parse of the free-text UsageCost field, e.g. "0.35 EUR/kWh"
        const raw = (s.raw as OcmPoi).UsageCost;
        if (!raw) return s;
        const match = raw.match(/([\d.,]+)\s*([A-Z]{3})\s*\/?\s*(kwh|kWh)?/i);
        if (!match) return s;
        const price = Number(match[1].replace(",", "."));
        if (!Number.isFinite(price)) return s;
        return {
          ...s,
          price: {
            fuelType: "ev_kwh",
            price,
            currency: match[2].toUpperCase(),
            unit: "kwh",
          },
        };
      });
  }
}
