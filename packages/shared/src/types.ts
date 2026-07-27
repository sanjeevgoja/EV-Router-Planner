export type StationKind = "fuel" | "ev_charging";

export type FuelType =
  | "regular"
  | "midgrade"
  | "premium"
  | "diesel"
  | "ev_kwh"
  | "ev_session";

export interface StationPrice {
  fuelType: FuelType;
  price: number;
  currency: string;
  unit: string; // 'gallon' | 'litre' | 'kwh' | 'session'
  source: string;
  granularity: "station" | "regional_average";
  recordedAt: string;
}

export interface Station {
  id: number;
  source: string;
  externalId: string;
  kind: StationKind;
  name: string | null;
  brand: string | null;
  fuelTypes: FuelType[];
  connectorTypes: string[];
  network: string | null;
  address: string | null;
  country: string | null;
  region: string | null;
  lon: number;
  lat: number;
  updatedAt: string;
  prices: StationPrice[];
}

export interface StationAlongRoute extends Station {
  distanceFromRouteMeters: number;
}

export type VehicleType = "gasoline" | "diesel" | "ev";

export interface RouteRequest {
  from: { lon: number; lat: number };
  to: { lon: number; lat: number };
  vehicleType: VehicleType;
  evRangeMeters?: number;
}

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
  instruction: string;
}

export interface RoutePlan {
  geometry: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
  legs: RouteLeg[];
}

export interface GeocodeResult {
  label: string;
  lon: number;
  lat: number;
  country: string | null;
}
