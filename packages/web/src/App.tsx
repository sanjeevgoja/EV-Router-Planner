import { useState } from "react";
import type { GeocodeResult, RoutePlan, StationAlongRoute, VehicleType } from "@ev-router/shared";
import { MapView } from "./map/MapView.js";
import { SearchBox } from "./components/SearchBox.js";
import { VehicleToggle } from "./components/VehicleToggle.js";
import { StationList } from "./components/StationList.js";
import { planRoute, stationsAlongRoute } from "./api/client.js";

export default function App() {
  const [from, setFrom] = useState<GeocodeResult | null>(null);
  const [to, setTo] = useState<GeocodeResult | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("gasoline");
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [stations, setStations] = useState<StationAlongRoute[]>([]);
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePlan() {
    if (!from || !to) {
      setError("Choose both a start and destination.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const plan = await planRoute({
        from: { lon: from.lon, lat: from.lat },
        to: { lon: to.lon, lat: to.lat },
        vehicleType,
      });
      setRoute(plan);
      const found = await stationsAlongRoute(plan.geometry, vehicleType);
      setStations(found);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>EV &amp; Fuel Router</h1>
        <p className="tagline">Cheapest stations along your route — North America &amp; Europe</p>

        <SearchBox placeholder="From" onSelect={setFrom} />
        <SearchBox placeholder="To" onSelect={setTo} />
        <VehicleToggle value={vehicleType} onChange={setVehicleType} />

        <button className="plan-button" onClick={handlePlan} disabled={loading}>
          {loading ? "Planning…" : "Plan route"}
        </button>

        {error && <p className="error">{error}</p>}

        {route && (
          <div className="route-summary">
            {(route.distanceMeters / 1000).toFixed(1)} km ·{" "}
            {Math.round(route.durationSeconds / 60)} min
          </div>
        )}

        <h2>Cheapest stations</h2>
        <p className="disclaimer">
          Prices come from open data (NREL AFDC, Open Charge Map, EIA, EU Weekly Oil
          Bulletin). Fuel prices are regional averages, not live per-pump prices —
          no free public feed for that exists. EV network costs are best-effort
          parsed from operator listings.
        </p>
        <StationList stations={stations} onHover={(s) => setHoveredStationId(s ? `${s.source}-${s.externalId}` : null)} />
      </aside>
      <main className="map-container">
        <MapView route={route} stations={stations} hoveredStationId={hoveredStationId} />
      </main>
    </div>
  );
}
