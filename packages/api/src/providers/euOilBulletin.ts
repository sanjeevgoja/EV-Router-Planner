import { request } from "undici";
import * as XLSX from "xlsx";
import type { RegionalPriceProvider, RegionalPriceRecord } from "./types.js";

// European Commission Weekly Oil Bulletin - free, no API key, published as an
// XLSX with historical per-member-state average prices (EUR/litre), updated
// weekly. This endpoint is a long-standing stable link maintained by the
// Commission's energy observatory but, being an unversioned spreadsheet
// export, its internal layout can change - parsing here is intentionally
// defensive and should be monitored if it starts returning zero rows.
const BULLETIN_URL =
  "https://ec.europa.eu/energy/observatory/reports/Oil_Bulletin_Prices_History.xlsx";

const FUEL_SHEETS: Array<{ sheetPattern: RegExp; fuelType: string }> = [
  { sheetPattern: /euro\s*-?\s*95/i, fuelType: "regular" },
  { sheetPattern: /diesel/i, fuelType: "diesel" },
];

export class EuOilBulletinProvider implements RegionalPriceProvider {
  readonly name = "eu_oil_bulletin";

  async fetchRegionalPrices(): Promise<RegionalPriceRecord[]> {
    const res = await request(BULLETIN_URL);
    if (res.statusCode >= 400) {
      throw new Error(`EU Oil Bulletin request failed: HTTP ${res.statusCode}`);
    }
    const buffer = Buffer.from(await res.body.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const results: RegionalPriceRecord[] = [];

    for (const { sheetPattern, fuelType } of FUEL_SHEETS) {
      const sheetName = workbook.SheetNames.find((n) => sheetPattern.test(n));
      if (!sheetName) continue;

      const sheet = workbook.Sheets[sheetName];
      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows.length < 2) continue;

      // Layout: first column is country/member state name, subsequent
      // columns are dated price columns (oldest -> newest). We take the
      // right-most numeric column per row as the latest price.
      for (const row of rows) {
        const label = row[0];
        if (typeof label !== "string" || !label.trim()) continue;
        if (/^euro.?zone|^eu\b|weighted average/i.test(label)) continue;

        let latestValue: number | null = null;
        for (let i = row.length - 1; i >= 1; i--) {
          const v = row[i];
          if (typeof v === "number" && Number.isFinite(v)) {
            latestValue = v;
            break;
          }
        }
        if (latestValue == null) continue;

        results.push({
          country: label.trim(),
          region: label.trim(),
          fuelType,
          price: latestValue,
          currency: "EUR",
          unit: "litre",
          source: this.name,
        });
      }
    }

    return results;
  }
}
