#!/usr/bin/env bash
# Downloads the configured OSM extract (VALHALLA_REGION_PBF_URL) and builds
# Valhalla routing tiles into /data on first boot. Skips work if tiles already
# exist so restarts are fast.
set -euo pipefail

DATA_DIR=/data
PBF_PATH="${DATA_DIR}/region.osm.pbf"
CONFIG_PATH="${DATA_DIR}/valhalla.json"

mkdir -p "${DATA_DIR}"

if [ ! -f "${DATA_DIR}/tiles/.built" ]; then
  echo "[valhalla] downloading extract from ${VALHALLA_REGION_PBF_URL}"
  curl -fL "${VALHALLA_REGION_PBF_URL}" -o "${PBF_PATH}"

  echo "[valhalla] generating config"
  valhalla_build_config \
    --mjolnir-tile-dir "${DATA_DIR}/tiles" \
    --mjolnir-timezone "${DATA_DIR}/timezones.sqlite" \
    --mjolnir-admin "${DATA_DIR}/admins.sqlite" \
    > "${CONFIG_PATH}"

  echo "[valhalla] building tiles (this can take a while for larger extracts)"
  valhalla_build_tiles -c "${CONFIG_PATH}" "${PBF_PATH}"
  touch "${DATA_DIR}/tiles/.built"
else
  echo "[valhalla] tiles already built, skipping"
fi

echo "[valhalla] starting service"
exec valhalla_service "${CONFIG_PATH}" 1
