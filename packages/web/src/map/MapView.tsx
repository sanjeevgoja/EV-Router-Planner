import { useEffect, useRef } from "react";
import maplibregl, { Map as MaplibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RoutePlan, StationAlongRoute } from "@ev-router/shared";

// OpenFreeMap - free, no API key required, vector tiles worldwide.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const ROUTE_SOURCE = "route";
const STATIONS_SOURCE = "stations";

interface Props {
  route: RoutePlan | null;
  stations: StationAlongRoute[];
  hoveredStationId: string | null;
}

function stationsToGeoJSON(stations: StationAlongRoute[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stations.map((s) => ({
      type: "Feature",
      id: `${s.source}-${s.externalId}`,
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: {
        key: `${s.source}-${s.externalId}`,
        name: s.name ?? s.brand ?? "Station",
        price: s.prices[0]?.price ?? null,
        currency: s.prices[0]?.currency ?? "",
        unit: s.prices[0]?.unit ?? "",
        updatedAt: s.prices[0]?.recordedAt ?? "",
      },
    })),
  };
}

export function MapView({ route, stations, hoveredStationId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [-98, 39],
      zoom: 4,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource(ROUTE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: ROUTE_SOURCE,
        type: "line",
        source: ROUTE_SOURCE,
        paint: { "line-color": "#2563eb", "line-width": 4 },
      });

      map.addSource(STATIONS_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 40,
      });
      map.addLayer({
        id: "stations-clusters",
        type: "circle",
        source: STATIONS_SOURCE,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#64748b",
          "circle-radius": 16,
        },
      });
      map.addLayer({
        id: "stations-cluster-count",
        type: "symbol",
        source: STATIONS_SOURCE,
        filter: ["has", "point_count"],
        layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
      });
      map.addLayer({
        id: "stations-points",
        type: "circle",
        source: STATIONS_SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#fff",
          "circle-color": [
            "case",
            ["==", ["get", "price"], ["literal", null]],
            "#94a3b8",
            [
              "interpolate",
              ["linear"],
              ["get", "price"],
              0, "#16a34a",
              2, "#eab308",
              5, "#dc2626",
            ],
          ],
        },
      });

      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
      map.on("mouseenter", "stations-points", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        const priceText =
          p.price != null ? `${p.price} ${p.currency}/${p.unit}` : "no price data";
        popup
          .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
          .setHTML(`<strong>${p.name}</strong><br/>${priceText}`)
          .addTo(map);
      });
      map.on("mouseleave", "stations-points", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      loadedRef.current = true;
      mapRef.current = map;
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (route) {
      source.setData({
        type: "Feature",
        properties: {},
        geometry: route.geometry,
      });
      const coords = route.geometry.coordinates;
      if (coords.length > 0) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
        );
        map.fitBounds(bounds, { padding: 60 });
      }
    } else {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource(STATIONS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(stationsToGeoJSON(stations));
  }, [stations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    map.setPaintProperty("stations-points", "circle-radius", [
      "case",
      ["==", ["get", "key"], hoveredStationId ?? ""],
      11,
      7,
    ]);
  }, [hoveredStationId]);

  return <div ref={containerRef} className="map-view" />;
}
