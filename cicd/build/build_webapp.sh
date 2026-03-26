#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="${ROOT_DIR}/dist/deployment"
WEB_BUILD_DIR="${ARTIFACT_DIR}/webapp-build"
WEB_ARCHIVE="${ARTIFACT_DIR}/webapp.tar.gz"
METADATA_FILE="${BUILD_METADATA_FILE:-${ARTIFACT_DIR}/build.env}"

mkdir -p "${ARTIFACT_DIR}"
rm -rf "${WEB_BUILD_DIR}"

pushd "${ROOT_DIR}/src/webapp" >/dev/null
npm ci
npm run build -- --configuration production --output-path "${WEB_BUILD_DIR}"
popd >/dev/null

if [[ -d "${WEB_BUILD_DIR}/browser" ]]; then
  tar -C "${WEB_BUILD_DIR}/browser" -czf "${WEB_ARCHIVE}" .
else
  tar -C "${WEB_BUILD_DIR}" -czf "${WEB_ARCHIVE}" .
fi

{
  echo "WEBAPP_ARCHIVE=${WEB_ARCHIVE}"
  echo "WEBAPP_BUILD_DIR=${WEB_BUILD_DIR}"
} >> "${METADATA_FILE}"

printf 'Webapp artifact written to %s\n' "${WEB_ARCHIVE}"
