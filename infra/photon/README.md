# Photon geocoder setup

Photon's search index is a Lucene index built from Nominatim/OSM data. Building
it yourself requires a full Nominatim import (large + slow), so for this
project we use komoot's prebuilt **per-country** search indexes instead, which
is by far the fastest way to get a real geocoder running locally.

## First run

1. Pick the country/region matching `PHOTON_COUNTRY_CODE` in `.env` (default `us`).
   Country index downloads are listed at https://github.com/komoot/photon#country-extracts
2. Download and extract it into `./data/photon/`:

   ```bash
   mkdir -p data/photon
   curl -o data/photon/photon-db-us.tar.bz2 \
     https://download1.graphhopper.com/public/extracts/by-country-code/us/photon-db-us-latest.tar.bz2
   tar -xjf data/photon/photon-db-us.tar.bz2 -C data/photon --strip-components=1
   ```

3. `docker compose up photon` will mount `./data/photon` and serve the index.

## Adding more countries (e.g. Europe)

Repeat step 2 for each additional country code (e.g. `de`, `fr`, `es`) into the
same `data/photon` volume — Photon can serve a merged index if you build it
that way, or run additional Photon containers per region behind the API's
`PHOTON_URL` config for a multi-region setup. For the MVP, a single country's
index is sufficient to demonstrate the full flow end-to-end.

## Disk/RAM notes

Per-country indexes range from ~100MB (small European countries) to several GB
(US, Germany, France). A combined NA+Europe index is tens of GB — plan storage
and RAM accordingly before scaling beyond the demo region.
