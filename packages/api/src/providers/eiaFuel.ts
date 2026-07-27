import { request } from "undici";
import { config } from "../config.js";
import type { RegionalPriceProvider, RegionalPriceRecord } from "./types.js";

// U.S. Energy Information Administration (EIA) Open Data API v2 - free,
// requires a free API key (https://www.eia.gov/opendata/register.php).
// Weekly average regular-grade and diesel retail prices, by PADD region.
// This is real US government data, refreshed weekly - not per-station-live,
// clearly labeled `granularity: regional_average` downstream.
const EIA_BASE = "https://api.eia.gov/v2";

// series routes: petroleum -> pri -> gnd (weekly retail gasoline/diesel prices)
const SERIES: Array<{ route: string; fuelType: string }> = [
  { route: "petroleum/pri/gnd/data", fuelType: "regular" }, // filtered by product below
];

interface EiaResponseRow {
  period: string;
  "area-name": string;
  product: string;
  "product-name": string;
  value: string;
  units: string;
}

export class EiaFuelProvider implements RegionalPriceProvider {
  readonly name = "eia";

  async fetchRegionalPrices(): Promise<RegionalPriceRecord[]> {
    if (!config.eiaApiKey) {
      throw new Error(
        "EIA_API_KEY is not set - register a free key at https://www.eia.gov/opendata/register.php"
      );
    }

    const results: RegionalPriceRecord[] = [];

    for (const { route } of SERIES) {
      const url = new URL(`${EIA_BASE}/${route}`);
      url.searchParams.set("api_key", config.eiaApiKey);
      url.searchParams.set("frequency", "weekly");
      url.searchParams.set("data[0]", "value");
      url.searchParams.set("sort[0][column]", "period");
      url.searchParams.set("sort[0][direction]", "desc");
      url.searchParams.set("length", "50");

      const res = await request(url);
      if (res.statusCode >= 400) {
        throw new Error(`EIA request failed: HTTP ${res.statusCode}`);
      }
      const body = (await res.body.json()) as { response: { data: EiaResponseRow[] } };

      for (const row of body.response.data) {
        const isRegular = /regular/i.test(row["product-name"] ?? "");
        const isDiesel = /diesel/i.test(row["product-name"] ?? "");
        if (!isRegular && !isDiesel) continue;

        results.push({
          country: "US",
          region: row["area-name"] ?? "US",
          fuelType: isDiesel ? "diesel" : "regular",
          price: Number(row.value),
          currency: "USD",
          unit: "gallon",
          source: this.name,
        });
      }
    }

    return results;
  }
}
