# EV & Fuel Router Planner

A self-hosted, map-based route planner for **North America and Europe** that finds
the cheapest fuel/EV-charging stations along your route.

- **Map**: MapLibre GL JS, free vector basemap ([OpenFreeMap](https://openfreemap.org))
- **Geocoding**: self-hosted [Photon](https://photon.komoot.io/)
- **Routing**: self-hosted [Valhalla](https://valhalla.github.io/valhalla/)
- **Spatial queries**: PostGIS (`ST_DWithin`, geography distance, GIST indexes)
- **Pricing/station data**: real open APIs, ingested on a schedule (see below)

```
┌─────────┐     ┌──────────────┐      ┌───────────────────────┐
│  web    │────▶│  api         │────▶│ postgis (stations,     │
│ (React, │     │ (Fastify TS) │      │ prices, spatial index) │
│ MapLibre│     │              │      └───────────────────────┘
│  GL JS) │     │              │────▶ valhalla (routing)
└─────────┘     │              │────▶ photon   (geocoding)
                │  ingest jobs │────▶ NREL AFDC / Open Charge Map /
                │  (node-cron) │      Overpass (OSM) / EIA / EU Oil Bulletin
                └──────────────┘
```

## Data sources — and their real limitations

| Source | What it provides | Coverage | Freshness |
|---|---|---|---|
| [NREL AFDC](https://developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/) | EV charging station locations, connectors, network | US, Canada, Mexico | Live registry, refreshed hourly by this app |
| [Open Charge Map](https://openchargemap.org/site/develop/api) | EV charging stations + best-effort operator pricing text | Global (strong EU coverage) | Live registry, refreshed hourly |
| [OpenStreetMap Overpass API](https://overpass-api.de/) | Real gas/diesel station **locations** (`amenity=fuel`) | Global | Refreshed hourly |
| [EIA Open Data v2](https://www.eia.gov/opendata/) | Regional average gasoline/diesel prices (by PADD) | US only | Official weekly average |
| [EU Weekly Oil Bulletin](https://energy.ec.europa.eu/) | Regional average fuel prices per member state | EU | Official weekly average |

**Important honesty note:** there is no free, public, per-station real-time fuel
price feed (services like GasBuddy are commercial/licensed). This project uses
the best legitimately-free sources: real station *locations* from OSM/NREL/OCM,
priced against official regional averages where no station-level price exists.
Every price shown in the UI is labeled `station` or `regional_average` with its
source and last-updated timestamp so it's never presented as something it isn't.
The pricing layer is a pluggable `PriceProvider`/`RegionalPriceProvider`
interface (`packages/api/src/providers/`) — swap in a paid live-pricing API
later without touching routing, spatial queries, or the frontend.

## Getting started

1. Copy the env template and fill in free API keys:
   ```bash
   cp .env.example .env
   ```
   - `EIA_API_KEY` — required for US fuel prices, register free at https://www.eia.gov/opendata/register.php
   - `NREL_API_KEY` — optional, defaults to rate-limited `DEMO_KEY`; get a free key at https://developer.nrel.gov/signup/
   - `OCM_API_KEY` — optional, raises Open Charge Map rate limits

2. Download a Photon country index (see [infra/photon/README.md](infra/photon/README.md)):
   ```bash
   mkdir -p data/photon
   curl -o data/photon/photon-db-us.tar.bz2 \
     https://download1.graphhopper.com/public/extracts/by-country-code/us/photon-db-us-latest.tar.bz2
   tar -xjf data/photon/photon-db-us.tar.bz2 -C data/photon --strip-components=1
   ```

3. Bring up the stack:
   ```bash
   docker compose up --build
   ```
   First boot downloads the demo-region OSM extract and builds Valhalla tiles
   (a few minutes for the default Colorado extract). Station/price ingestion
   kicks off automatically ~5 seconds after the API boots, then hourly (stations)
   and daily (regional prices) after that.

4. Open http://localhost:5173, search a from/to within the demo region
   (Colorado, US by default), pick gasoline/diesel/EV, and plan a route.

## Scaling beyond the demo region

The default Docker Compose setup uses **one small region** (Colorado + a
Luxembourg-centered Open Charge Map query) so a first run is fast. Building
full North America + Europe Valhalla tiles and Photon indexes needs **tens of
GB of disk and 32GB+ RAM** and can take hours — expected for a production
deployment, not a first bring-up. To scale up:

- Set `VALHALLA_REGION_PBF_URL` to a larger [Geofabrik](https://download.geofabrik.de/)
  extract (a full continent, or Europe/North America combined via a merge step)
- Download additional [Photon country indexes](https://github.com/komoot/photon#country-extracts)
  for more of Europe
- Widen `STATION_BBOX`, `STATION_BBOX_OVERPASS`, and `STATION_LATLON`/`STATION_RADIUS_KM`
  env vars used by the ingestion providers

## Known MVP limitations

- EV routing uses Valhalla's `auto` costing profile with EV-friendly tuning,
  not a full range-aware costing model with charging-stop injection (documented
  follow-up — Valhalla's native EV costing is still evolving upstream)
- Fuel prices are regional averages except where an EV operator publishes a
  real per-station rate
- The EU Oil Bulletin ingester parses a public spreadsheet whose internal
  layout isn't versioned — if it starts returning 0 rows, the parser in
  `packages/api/src/providers/euOilBulletin.ts` likely needs a layout update

## Repo layout

```
packages/shared   shared TypeScript types (Station, RoutePlan, ...)
packages/api      Fastify API: geocode/route proxies, PostGIS spatial queries,
                  pricing provider adapters, scheduled ingestion jobs
packages/web      Vite + React + MapLibre GL JS frontend
db/init           PostGIS schema
infra/valhalla    tile-build entrypoint script
infra/photon      instructions for prebuilt search indexes
```
