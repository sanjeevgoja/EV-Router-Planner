import { request } from "undici";
import type { StationProvider, StationRecord } from "./types.js";

// There is no free, open, per-station database of gas station *locations*
// with an official API - so we source real station locations from
// OpenStreetMap (amenity=fuel) via the free Overpass API, and pair them with
// regional average pricing from EIA / EU Weekly Oil Bulletin at query time
// (see eiaFuel.ts / euOilBulletin.ts). This gives real, current station
// locations even though per-pump live pricing isn't publicly available for free.
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

const DEFAULT_BBOX = "36.9,-109.1,41.1,-102.0"; // south,west,north,east (Colorado)

interface OverpassElement {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export class OverpassFuelStationsProvider implements StationProvider {
  readonly name = "osm_overpass";

  async fetchStations(): Promise<StationRecord[]> {
    const bbox = process.env.STATION_BBOX_OVERPASS ?? DEFAULT_BBOX;
    const query = `
      [out:json][timeout:60];
      (
        node["amenity"="fuel"](${bbox});
        way["amenity"="fuel"](${bbox});
      );
      out center tags;
    `;

    const res = await request(OVERPASS_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (res.statusCode >= 400) {
      throw new Error(`Overpass request failed: HTTP ${res.statusCode}`);
    }
    const body = (await res.body.json()) as { elements: OverpassElement[] };

    return body.elements
      .map((el) => {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (lat == null || lon == null) return null;
        const tags = el.tags ?? {};
        const fuelTypes: string[] = [];
        if (tags["fuel:diesel"] === "yes") fuelTypes.push("diesel");
        if (tags["fuel:octane_87"] === "yes" || tags["fuel:regular"] === "yes")
          fuelTypes.push("regular");
        if (tags["fuel:octane_91"] === "yes" || tags["fuel:premium"] === "yes")
          fuelTypes.push("premium");
        if (fuelTypes.length === 0) fuelTypes.push("regular", "diesel");

        const record: StationRecord = {
          source: this.name,
          externalId: String(el.id),
          kind: "fuel",
          name: tags.name ?? tags.brand ?? null,
          brand: tags.brand ?? null,
          fuelTypes,
          connectorTypes: [],
          network: null,
          address: [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]]
            .filter(Boolean)
            .join(" "),
          country: tags["addr:country"] ?? null,
          region: tags["addr:state"] ?? tags["addr:province"] ?? null,
          lon,
          lat,
          raw: tags,
        };
        return record;
      })
      .filter((r): r is StationRecord => r !== null);
  }
}
