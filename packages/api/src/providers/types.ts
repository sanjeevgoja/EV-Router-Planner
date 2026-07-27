export interface StationRecord {
  source: string;
  externalId: string;
  kind: "fuel" | "ev_charging";
  name: string | null;
  brand: string | null;
  fuelTypes: string[];
  connectorTypes: string[];
  network: string | null;
  address: string | null;
  country: string | null;
  region: string | null;
  lon: number;
  lat: number;
  raw: unknown;
  price?: {
    fuelType: string;
    price: number;
    currency: string;
    unit: string;
  };
}

export interface RegionalPriceRecord {
  country: string;
  region: string;
  fuelType: string;
  price: number;
  currency: string;
  unit: string;
  source: string;
}

/** A pluggable source of station and/or pricing data. Implementations should
 * only throw on hard failures (network/auth) - partial/empty results are fine. */
export interface StationProvider {
  readonly name: string;
  fetchStations(): Promise<StationRecord[]>;
}

export interface RegionalPriceProvider {
  readonly name: string;
  fetchRegionalPrices(): Promise<RegionalPriceRecord[]>;
}
