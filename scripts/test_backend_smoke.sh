#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

node --test src/backend/tests/api.test.js --test-name-pattern='GET /api/health returns a healthy status|GET /api/business-ideas returns workspace options|GET /api/business-ideas/:workspaceId returns the strategy hub payload|POST /api/business-ideas/:workspaceId/ideation/messages runs the ideation workflow and returns refreshed workspace data|GET /api/admin/agents returns persisted agents with gateway runtime metadata|GET /api/admin/agents/:id returns one persisted agent without mutating state|PATCH /api/admin/agents/:id updates agent registry and prompt config'
src/backend/.venv/bin/pytest \
  src/backend/tests/test_runtime_registry.py \
  src/backend/tests/test_registered_agent_execution.py \
  src/backend/tests/test_runtime_llm_audit.py \
  src/backend/tests/test_llm_gateway_logging.py
