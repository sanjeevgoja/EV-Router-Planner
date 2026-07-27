import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { geocodeRoutes } from "./routes/geocode.js";
import { routeRoutes } from "./routes/route.js";
import { stationsRoutes } from "./routes/stations.js";
import { startScheduler } from "./ingest/scheduler.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: config.corsOrigin });

app.get("/api/health", async () => ({ status: "ok" }));

await app.register(geocodeRoutes);
await app.register(routeRoutes);
await app.register(stationsRoutes);

startScheduler();

app.listen({ port: config.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
