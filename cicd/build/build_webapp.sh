#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="${ROOT_DIR}/dist/deployment"
WEB_BUILD_DIR="${ARTIFACT_DIR}/webapp-build"
WEB_ARCHIVE="${ARTIFACT_DIR}/webapp.tar.gz"
METADATA_FILE="${BUILD_METADATA_FILE:-${ARTIFACT_DIR}/build.env}"
FRONTEND_AUTH_SERVICE_SIGN_IN_URL="${FRONTEND_AUTH_SERVICE_SIGN_IN_URL:-https://auth.life-sqrd.com/signIn}"
FRONTEND_AUTH_SERVICE_SIGN_OUT_URL="${FRONTEND_AUTH_SERVICE_SIGN_OUT_URL:-https://auth.life-sqrd.com/logout}"
FRONTEND_APP_BASE_URL="${FRONTEND_APP_BASE_URL:-https://helm-os.ai/app/}"
FRONTEND_API_BASE_URL="${FRONTEND_API_BASE_URL:-https://api.helm-os.ai}"
WEBAPP_BASE_HREF="${WEBAPP_BASE_HREF:-/app/}"

mkdir -p "${ARTIFACT_DIR}"
rm -rf "${WEB_BUILD_DIR}"

pushd "${ROOT_DIR}/src/webapp" >/dev/null
npm ci
npm run build -- --configuration production --output-path "${WEB_BUILD_DIR}" --base-href "${WEBAPP_BASE_HREF}"
popd >/dev/null

WEB_RUNTIME_ROOT="${WEB_BUILD_DIR}"
if [[ -d "${WEB_BUILD_DIR}/browser" ]]; then
  WEB_RUNTIME_ROOT="${WEB_BUILD_DIR}/browser"
fi

cat > "${WEB_RUNTIME_ROOT}/helmos-config.js" <<EOF
window.__HELMOS_CONFIG__ = Object.assign({
  authServiceSignInUrl: "${FRONTEND_AUTH_SERVICE_SIGN_IN_URL}",
  authServiceSignOutUrl: "${FRONTEND_AUTH_SERVICE_SIGN_OUT_URL}",
  appBaseUrl: "${FRONTEND_APP_BASE_URL}",
  apiBaseUrl: "${FRONTEND_API_BASE_URL}"
}, window.__HELMOS_CONFIG__ || {});
EOF

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
