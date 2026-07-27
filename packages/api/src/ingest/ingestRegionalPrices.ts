import { query } from "../db.js";
import type { RegionalPriceProvider } from "../providers/types.js";

export async function ingestRegionalPrices(
  provider: RegionalPriceProvider
): Promise<number> {
  const prices = await provider.fetchRegionalPrices();

  for (const p of prices) {
    await query(
      `INSERT INTO regional_fuel_prices
         (country, region, fuel_type, price, currency, unit, source, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now())
       ON CONFLICT (country, region, fuel_type, source, recorded_at) DO NOTHING`,
      [p.country, p.region, p.fuelType, p.price, p.currency, p.unit, provider.name]
    );
  }

  return prices.length;
}
