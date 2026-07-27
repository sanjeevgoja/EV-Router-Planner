import type {
  GeocodeResult,
  RouteRequest,
  RoutePlan,
  StationAlongRoute,
  VehicleType,
} from "@ev-router/shared";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function geocode(q: string): Promise<GeocodeResult[]> {
  if (!q.trim()) return [];
  const res = await fetch(`${BASE_URL}/api/geocode?q=${encodeURIComponent(q)}`);
  const body = await json<{ results: GeocodeResult[] }>(res);
  return body.results;
}

export async function planRoute(req: RouteRequest): Promise<RoutePlan> {
  const res = await fetch(`${BASE_URL}/api/route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  return json<RoutePlan>(res);
}

export async function stationsAlongRoute(
  geometry: GeoJSON.LineString,
  vehicleType: VehicleType,
  bufferMeters = 5000
): Promise<StationAlongRoute[]> {
  const res = await fetch(`${BASE_URL}/api/stations/along-route`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ geometry, vehicleType, bufferMeters }),
  });
  const body = await json<{ stations: StationAlongRoute[] }>(res);
  return body.stations;
}
