import type { FastifyInstance } from "fastify";
import { request } from "undici";
import polyline from "@mapbox/polyline";
import { config } from "../config.js";
import type { RouteRequest, RoutePlan } from "@ev-router/shared";

interface ValhallaManeuver {
  length: number; // km
  time: number; // seconds
  instruction: string;
}

interface ValhallaLeg {
  shape: string;
  maneuvers: ValhallaManeuver[];
}

interface ValhallaResponse {
  trip: {
    summary: { length: number; time: number };
    legs: ValhallaLeg[];
  };
}

// Valhalla doesn't (yet) ship a mature native EV costing model, so for the
// MVP we approximate EV routing by using the `auto` costing profile with
// conservative highway-speed penalties - a real range-aware EV router would
// additionally need to inject charging-stop waypoints, which is left as a
// documented follow-up.
function costingFor(vehicleType: RouteRequest["vehicleType"]): {
  costing: string;
  costing_options?: Record<string, unknown>;
} {
  switch (vehicleType) {
    case "diesel":
      return { costing: "truck" };
    case "ev":
      return {
        costing: "auto",
        costing_options: { auto: { use_highways: 0.7, use_tolls: 0.5 } },
      };
    default:
      return { costing: "auto" };
  }
}

export async function routeRoutes(app: FastifyInstance) {
  app.post("/api/route", async (req, reply) => {
    const body = req.body as RouteRequest;
    if (!body?.from || !body?.to) {
      return reply.code(400).send({ error: "missing 'from'/'to'" });
    }

    const payload = {
      locations: [
        { lon: body.from.lon, lat: body.from.lat },
        { lon: body.to.lon, lat: body.to.lat },
      ],
      ...costingFor(body.vehicleType),
      units: "kilometers",
    };

    const res = await request(`${config.valhallaUrl}/route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.statusCode >= 400) {
      return reply.code(502).send({ error: "valhalla upstream error" });
    }
    const valhalla = (await res.body.json()) as ValhallaResponse;

    const coordinates: [number, number][] = [];
    const legs = valhalla.trip.legs.flatMap((leg) => {
      const decoded = polyline.decode(leg.shape, 6);
      coordinates.push(...decoded.map(([lat, lon]) => [lon, lat] as [number, number]));
      return leg.maneuvers.map((m) => ({
        distanceMeters: m.length * 1000,
        durationSeconds: m.time,
        instruction: m.instruction,
      }));
    });

    const plan: RoutePlan = {
      geometry: { type: "LineString", coordinates },
      distanceMeters: valhalla.trip.summary.length * 1000,
      durationSeconds: valhalla.trip.summary.time,
      legs,
    };

    return plan;
  });
}
