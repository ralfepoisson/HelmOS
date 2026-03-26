#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="${ROOT_DIR}/dist/deployment"
FINAL_METADATA_FILE="${ARTIFACT_DIR}/build.env"
TEMP_METADATA_FILE="${ARTIFACT_DIR}/build.env.tmp"

mkdir -p "${ARTIFACT_DIR}"
: > "${TEMP_METADATA_FILE}"
export BUILD_METADATA_FILE="${TEMP_METADATA_FILE}"

"${ROOT_DIR}/cicd/build/build_webapp.sh"
"${ROOT_DIR}/cicd/build/build_node_api_image.sh"
"${ROOT_DIR}/cicd/build/build_agent_gateway_image.sh"
"${ROOT_DIR}/cicd/build/build_litellm_image.sh"

echo "BUILD_METADATA_COMPLETE=1" >> "${TEMP_METADATA_FILE}"
mv "${TEMP_METADATA_FILE}" "${FINAL_METADATA_FILE}"

printf 'Deployment build metadata written to %s\n' "${FINAL_METADATA_FILE}"
