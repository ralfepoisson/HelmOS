#!/bin/bash

if [[ -n "${BASH_VERSION:-}" && -n "${BASH_SOURCE[0]:-}" ]]; then
  SCRIPT_PATH="${BASH_SOURCE[0]}"
elif [[ -n "${ZSH_VERSION:-}" ]]; then
  SCRIPT_PATH="${(%):-%N}"
else
  SCRIPT_PATH="$0"
fi

SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_PATH}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILD_METADATA_FILE="${ROOT_DIR}/dist/deployment/build.env"

export AWS_REGION=eu-west-1
export HOSTED_ZONE_ID=Z00884357UB3LIBX2G32
export ROOT_DOMAIN=helm-os.ai
export WWW_DOMAIN=www.helm-os.ai
export API_DOMAIN=api.helm-os.ai

if [[ -f "${BUILD_METADATA_FILE}" ]]; then
  while IFS='=' read -r key value; do
    [[ -z "${key}" || "${key}" == \#* ]] && continue
    export "${key}=${value}"
  done < "${BUILD_METADATA_FILE}"
fi
