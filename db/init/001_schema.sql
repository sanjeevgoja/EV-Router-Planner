-- EV & Fuel Router Planner schema
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS stations (
    id              BIGSERIAL PRIMARY KEY,
    source          TEXT        NOT NULL,           -- 'nrel_afdc' | 'open_charge_map'
    external_id     TEXT        NOT NULL,            -- id from the source system
    kind            TEXT        NOT NULL,            -- 'fuel' | 'ev_charging'
    name            TEXT,
    brand           TEXT,
    fuel_types      TEXT[]      NOT NULL DEFAULT '{}', -- e.g. {regular,midgrade,premium,diesel,ev}
    connector_types TEXT[]      NOT NULL DEFAULT '{}', -- EV only, e.g. {CCS,CHAdeMO,J1772,NACS}
    network         TEXT,                              -- EV charging network name
    address         TEXT,
    country         TEXT,                              -- ISO 3166-1 alpha-2
    region          TEXT,                              -- state/province/PADD/EU member state
    geom            GEOGRAPHY(Point, 4326) NOT NULL,
    raw             JSONB,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS stations_geom_gix ON stations USING GIST (geom);
CREATE INDEX IF NOT EXISTS stations_kind_idx ON stations (kind);
CREATE INDEX IF NOT EXISTS stations_country_idx ON stations (country);

CREATE TABLE IF NOT EXISTS station_prices (
    id           BIGSERIAL PRIMARY KEY,
    station_id   BIGINT      REFERENCES stations(id) ON DELETE CASCADE,
    fuel_type    TEXT        NOT NULL,               -- 'regular' | 'diesel' | 'ev_kwh' | ...
    price        NUMERIC(10, 4) NOT NULL,
    currency     TEXT        NOT NULL,               -- 'USD' | 'CAD' | 'EUR' | ...
    unit         TEXT        NOT NULL,               -- 'gallon' | 'litre' | 'kwh' | 'session'
    source       TEXT        NOT NULL,               -- 'eia' | 'eu_oil_bulletin' | 'nrel_afdc' | 'open_charge_map'
    granularity  TEXT        NOT NULL DEFAULT 'station', -- 'station' | 'regional_average'
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS station_prices_lookup_idx
    ON station_prices (station_id, fuel_type, recorded_at DESC);

-- Regional average prices (EIA / EU bulletin) are not tied to one station row;
-- they're stored against a synthetic per-region "virtual station" pointer via
-- region + country instead, joined at query time to nearby real stations.
CREATE TABLE IF NOT EXISTS regional_fuel_prices (
    id           BIGSERIAL PRIMARY KEY,
    country      TEXT        NOT NULL,
    region       TEXT        NOT NULL,               -- PADD name (US) or member state (EU)
    fuel_type    TEXT        NOT NULL,
    price        NUMERIC(10, 4) NOT NULL,
    currency     TEXT        NOT NULL,
    unit         TEXT        NOT NULL,
    source       TEXT        NOT NULL,
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (country, region, fuel_type, source, recorded_at)
);

CREATE OR REPLACE VIEW latest_station_prices AS
SELECT DISTINCT ON (station_id, fuel_type)
    station_id, fuel_type, price, currency, unit, source, recorded_at
FROM station_prices
ORDER BY station_id, fuel_type, recorded_at DESC;

CREATE OR REPLACE VIEW latest_regional_fuel_prices AS
SELECT DISTINCT ON (country, region, fuel_type)
    country, region, fuel_type, price, currency, unit, source, recorded_at
FROM regional_fuel_prices
ORDER BY country, region, fuel_type, recorded_at DESC;
