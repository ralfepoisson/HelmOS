#!/bin/bash

set -a
if [[ -f ../.env ]]; then
  source ../.env
fi
set +a

cd ../src/backend

python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
