#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

set -a
if [[ -f "$REPO_ROOT/.env" ]]; then
  source "$REPO_ROOT/.env"
fi
if [[ -f "$REPO_ROOT/src/backend/.env" ]]; then
  source "$REPO_ROOT/src/backend/.env"
fi
set +a

cd "$REPO_ROOT/src/backend"
npm run backend:dev
