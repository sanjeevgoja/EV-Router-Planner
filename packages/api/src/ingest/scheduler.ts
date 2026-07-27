import cron from "node-cron";
import { ingestStations } from "./ingestStations.js";
import { ingestRegionalPrices } from "./ingestRegionalPrices.js";
import { NrelAfdcProvider } from "../providers/nrelAfdc.js";
import { OpenChargeMapProvider } from "../providers/openChargeMap.js";
import { OverpassFuelStationsProvider } from "../providers/overpassFuel.js";
import { EiaFuelProvider } from "../providers/eiaFuel.js";
import { EuOilBulletinProvider } from "../providers/euOilBulletin.js";

const stationProviders = [
  new NrelAfdcProvider(),
  new OpenChargeMapProvider(),
  new OverpassFuelStationsProvider(),
];
const regionalPriceProviders = [new EiaFuelProvider(), new EuOilBulletinProvider()];

async function runStationIngest() {
  for (const provider of stationProviders) {
    try {
      const count = await ingestStations(provider);
      console.log(`[scheduler] ${provider.name}: upserted ${count} stations`);
    } catch (err) {
      console.error(`[scheduler] ${provider.name} failed:`, (err as Error).message);
    }
  }
}

async function runRegionalPriceIngest() {
  for (const provider of regionalPriceProviders) {
    try {
      const count = await ingestRegionalPrices(provider);
      console.log(`[scheduler] ${provider.name}: upserted ${count} regional prices`);
    } catch (err) {
      console.error(`[scheduler] ${provider.name} failed:`, (err as Error).message);
    }
  }
}

export function startScheduler() {
  // Station lists (EV networks, OSM fuel POIs) refresh hourly.
  cron.schedule("0 * * * *", runStationIngest);
  // Regional average fuel prices are only published weekly upstream; daily
  // is more than enough and cheap to run.
  cron.schedule("0 6 * * *", runRegionalPriceIngest);

  // Kick off an initial ingest shortly after boot so the demo isn't empty.
  setTimeout(() => {
    runStationIngest();
    runRegionalPriceIngest();
  }, 5_000);
}
