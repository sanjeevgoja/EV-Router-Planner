import { ingestStations } from "./ingestStations.js";
import { ingestRegionalPrices } from "./ingestRegionalPrices.js";
import { NrelAfdcProvider } from "../providers/nrelAfdc.js";
import { OpenChargeMapProvider } from "../providers/openChargeMap.js";
import { OverpassFuelStationsProvider } from "../providers/overpassFuel.js";
import { EiaFuelProvider } from "../providers/eiaFuel.js";
import { EuOilBulletinProvider } from "../providers/euOilBulletin.js";
import { pool } from "../db.js";

async function main() {
  const mode = process.argv[2];

  if (mode === "ev") {
    for (const provider of [new NrelAfdcProvider(), new OpenChargeMapProvider()]) {
      try {
        const count = await ingestStations(provider);
        console.log(`[ingest] ${provider.name}: upserted ${count} stations`);
      } catch (err) {
        console.error(`[ingest] ${provider.name} failed:`, (err as Error).message);
      }
    }
    try {
      const count = await ingestStations(new OverpassFuelStationsProvider());
      console.log(`[ingest] osm_overpass: upserted ${count} fuel stations`);
    } catch (err) {
      console.error("[ingest] osm_overpass failed:", (err as Error).message);
    }
  } else if (mode === "fuel") {
    for (const provider of [new EiaFuelProvider(), new EuOilBulletinProvider()]) {
      try {
        const count = await ingestRegionalPrices(provider);
        console.log(`[ingest] ${provider.name}: upserted ${count} regional prices`);
      } catch (err) {
        console.error(`[ingest] ${provider.name} failed:`, (err as Error).message);
      }
    }
  } else {
    console.error("Usage: tsx runOnce.ts <ev|fuel>");
    process.exitCode = 1;
  }

  await pool.end();
}

main();
