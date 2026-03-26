#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 4 ]]; then
  printf 'Usage: %s <dockerfile> <image-name> <image-tag> <context-dir>\n' "$0" >&2
  exit 1
fi

DOCKERFILE="$1"
IMAGE_NAME="$2"
IMAGE_TAG="$3"
CONTEXT_DIR="$4"

if docker buildx version >/dev/null 2>&1; then
  docker buildx build \
    --load \
    -f "${DOCKERFILE}" \
    -t "${IMAGE_NAME}:${IMAGE_TAG}" \
    "${CONTEXT_DIR}"
else
  printf 'Warning: docker buildx is not installed; falling back to deprecated legacy docker build.\n' >&2
  printf 'Install Docker Buildx to remove this warning: https://docs.docker.com/go/buildx/\n' >&2
  docker build -f "${DOCKERFILE}" -t "${IMAGE_NAME}:${IMAGE_TAG}" "${CONTEXT_DIR}"
fi
