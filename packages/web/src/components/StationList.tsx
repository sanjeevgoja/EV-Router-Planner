import type { StationAlongRoute } from "@ev-router/shared";

interface Props {
  stations: StationAlongRoute[];
  onHover?: (station: StationAlongRoute | null) => void;
}

function formatPrice(s: StationAlongRoute): string {
  const p = s.prices[0];
  if (!p) return "no price data";
  const amount = p.price.toFixed(p.unit === "kwh" ? 3 : 2);
  const label = `${amount} ${p.currency}/${p.unit}`;
  return p.granularity === "regional_average" ? `${label} (regional avg.)` : label;
}

export function StationList({ stations, onHover }: Props) {
  if (stations.length === 0) {
    return <p className="station-list-empty">No stations found along this route yet.</p>;
  }

  return (
    <ul className="station-list">
      {stations.map((s) => (
        <li
          key={`${s.source}-${s.externalId}`}
          onMouseEnter={() => onHover?.(s)}
          onMouseLeave={() => onHover?.(null)}
        >
          <div className="station-list-name">{s.name ?? s.brand ?? "Unnamed station"}</div>
          <div className="station-list-price">{formatPrice(s)}</div>
          <div className="station-list-meta">
            {(s.distanceFromRouteMeters / 1000).toFixed(1)} km off route
            {s.prices[0] && (
              <> · updated {new Date(s.prices[0].recordedAt).toLocaleDateString()}</>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
