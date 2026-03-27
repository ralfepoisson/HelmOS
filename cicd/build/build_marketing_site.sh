#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="${ROOT_DIR}/dist/deployment"
SITE_BUILD_DIR="${ARTIFACT_DIR}/marketing-site-build"
SITE_ARCHIVE="${ARTIFACT_DIR}/marketing-site.tar.gz"
METADATA_FILE="${BUILD_METADATA_FILE:-${ARTIFACT_DIR}/build.env}"

mkdir -p "${ARTIFACT_DIR}"
rm -rf "${SITE_BUILD_DIR}"
mkdir -p "${SITE_BUILD_DIR}/node_modules/bootstrap/dist/css"
mkdir -p "${SITE_BUILD_DIR}/node_modules/angular"
mkdir -p "${SITE_BUILD_DIR}/node_modules/angular-route"

pushd "${ROOT_DIR}/src/web" >/dev/null
npm ci
popd >/dev/null

cp "${ROOT_DIR}/src/web/index.html" "${SITE_BUILD_DIR}/index.html"
cp -R "${ROOT_DIR}/src/web/app" "${SITE_BUILD_DIR}/app"
cp -R "${ROOT_DIR}/src/web/assets" "${SITE_BUILD_DIR}/assets"
cp "${ROOT_DIR}/src/web/node_modules/bootstrap/dist/css/bootstrap.min.css" \
  "${SITE_BUILD_DIR}/node_modules/bootstrap/dist/css/bootstrap.min.css"
cp "${ROOT_DIR}/src/web/node_modules/angular/angular.min.js" \
  "${SITE_BUILD_DIR}/node_modules/angular/angular.min.js"
cp "${ROOT_DIR}/src/web/node_modules/angular-route/angular-route.min.js" \
  "${SITE_BUILD_DIR}/node_modules/angular-route/angular-route.min.js"

tar -C "${SITE_BUILD_DIR}" -czf "${SITE_ARCHIVE}" .

{
  echo "MARKETING_SITE_ARCHIVE=${SITE_ARCHIVE}"
  echo "MARKETING_SITE_BUILD_DIR=${SITE_BUILD_DIR}"
} >> "${METADATA_FILE}"

printf 'Marketing site artifact written to %s\n' "${SITE_ARCHIVE}"
