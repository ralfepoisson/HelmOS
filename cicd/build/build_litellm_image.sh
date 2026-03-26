#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACT_DIR="${ROOT_DIR}/dist/deployment"
METADATA_FILE="${BUILD_METADATA_FILE:-${ARTIFACT_DIR}/build.env}"
IMAGE_TAG="${IMAGE_TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
IMAGE_NAME="helmos/litellm"
IMAGE_TAR="${ARTIFACT_DIR}/litellm-${IMAGE_TAG}.tar"

mkdir -p "${ARTIFACT_DIR}"

"${ROOT_DIR}/cicd/build/docker_build.sh" "${ROOT_DIR}/cicd/build/Dockerfile.litellm" "${IMAGE_NAME}" "${IMAGE_TAG}" "${ROOT_DIR}"
docker save -o "${IMAGE_TAR}" "${IMAGE_NAME}:${IMAGE_TAG}"

{
  echo "LITELLM_IMAGE_NAME=${IMAGE_NAME}"
  echo "LITELLM_IMAGE_TAG=${IMAGE_TAG}"
  echo "LITELLM_IMAGE_TAR=${IMAGE_TAR}"
} >> "${METADATA_FILE}"

printf 'LiteLLM image artifact written to %s\n' "${IMAGE_TAR}"
