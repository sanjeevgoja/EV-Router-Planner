import type { FastifyInstance } from "fastify";
import { request } from "undici";
import { config } from "../config.js";
import type { GeocodeResult } from "@ev-router/shared";

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
}

function toResult(f: PhotonFeature): GeocodeResult {
  const p = f.properties;
  const label = [p.name, p.city, p.state, p.country].filter(Boolean).join(", ");
  return {
    label,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    country: p.countrycode ?? null,
  };
}

export async function geocodeRoutes(app: FastifyInstance) {
  app.get("/api/geocode", async (req, reply) => {
    const q = (req.query as Record<string, string>).q;
    if (!q) return reply.code(400).send({ error: "missing query param 'q'" });

    const url = new URL(`${config.photonUrl}/api`);
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "8");

    const res = await request(url);
    if (res.statusCode >= 400) {
      return reply.code(502).send({ error: "photon upstream error" });
    }
    const body = (await res.body.json()) as { features: PhotonFeature[] };
    return { results: body.features.map(toResult) };
  });

  app.get("/api/reverse", async (req, reply) => {
    const { lon, lat } = req.query as Record<string, string>;
    if (!lon || !lat) {
      return reply.code(400).send({ error: "missing query params 'lon'/'lat'" });
    }

    const url = new URL(`${config.photonUrl}/reverse`);
    url.searchParams.set("lon", lon);
    url.searchParams.set("lat", lat);

    const res = await request(url);
    if (res.statusCode >= 400) {
      return reply.code(502).send({ error: "photon upstream error" });
    }
    const body = (await res.body.json()) as { features: PhotonFeature[] };
    return { results: body.features.map(toResult) };
  });
}
