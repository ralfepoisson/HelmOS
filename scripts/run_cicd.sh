#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "================================"
echo "Building Artifacts"
echo "================================"
"${SCRIPT_DIR}/../cicd/build/build_all.sh"

echo "================================"
echo "Deploying to AWS"
echo "================================"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/export_env_vars.sh"
"${SCRIPT_DIR}/../cicd/serverless/deploy.sh"
