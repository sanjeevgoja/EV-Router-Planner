# EV & Fuel Router Planner

A self-hosted, map-based route planner for **North America and Europe**. Enter
a start and destination, pick gasoline, diesel, or EV, and it plans your route
and shows you the cheapest fuel or charging stations along the way.

Prices are always labeled with where they came from and how fresh they are -
either a real station-level price or an official regional average - so you
always know what you're looking at. (No source publishes free, real-time,
per-station prices everywhere, so this project uses the best legitimately-free
data available. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full breakdown
of data sources.)

## Getting started

Everything runs locally via Docker - no data leaves your machine except calls
to the free public APIs below.

1. **Get your free API keys and set up your environment file:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and fill in:
   - `EIA_API_KEY` - required for US fuel prices, register free at https://www.eia.gov/opendata/register.php
   - `NREL_API_KEY` - optional, defaults to rate-limited `DEMO_KEY`; get a free key at https://developer.nrel.gov/signup/
   - `OCM_API_KEY` - optional, raises Open Charge Map rate limits

2. **Download a map search index** (see [infra/photon/README.md](infra/photon/README.md)
   for other countries):
   ```bash
   mkdir -p data/photon
   curl -o data/photon/photon-db-us.tar.bz2 \
     https://download1.graphhopper.com/public/extracts/by-country-code/us/photon-db-us-latest.tar.bz2
   tar -xjf data/photon/photon-db-us.tar.bz2 -C data/photon --strip-components=1
   ```

3. **Start everything:**
   ```bash
   docker compose up --build
   ```
   The first boot takes a few minutes - it downloads a demo map region
   (Colorado, by default) and builds the routing engine's map tiles. Station
   and price data starts loading automatically about 5 seconds after the app
   is up, refreshing hourly (stations) and daily (prices) after that.

4. **Open the app:** go to <http://localhost:5173>, search a start and
   destination within the demo region (Colorado, US by default), choose
   gasoline, diesel, or EV, and plan your route.

## Covering more than the demo region

By default the app only covers a small demo area (Colorado, plus a small EV
test area in Luxembourg) so your first run is fast. Covering all of North
America and Europe needs tens of GB of disk space and 32GB+ of RAM, and can
take hours to set up - worth it once you're ready to actually use the app day
to day, but not something you need for a first look. See
[ARCHITECTURE.md](ARCHITECTURE.md#scaling-beyond-the-demo-region) for how to
expand coverage.

## Current limitations

- EV routing doesn't yet account for vehicle range or plan charging stops
  automatically - it routes like a car trip with EV-friendly preferences
- Fuel prices are regional averages except where a station or EV network
  publishes its own real-time rate
- Occasionally the EU price feed changes format upstream and needs a fix on
  our end before EU prices update again

## For developers

See [ARCHITECTURE.md](ARCHITECTURE.md) for the system diagram, data source
details, repo layout, and known technical limitations.
