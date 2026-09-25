#!/usr/bin/env bash
# Quality gate: format -> lint -> type-check -> tests -> build -> audits, for every package.
# Usage: scripts/quality-gate.sh [backend|db|ai|mobile|admin-web|all]   (default: all)
# The db target needs the docker-compose services running; set SKIP_DB=1 to leave it out of "all".
set -euo pipefail

# This script lives in 6-infrastructure/scripts; the repository root is two levels up.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/3-application-logic/backend"
AI="$ROOT/4-ai-intelligence-layer/ai-services"
MOBILE="$ROOT/1-presentation-layer/mobile-app"
ADMIN_WEB="$ROOT/1-presentation-layer/admin-panel-web"
TARGET="${1:-all}"
FAILED=()

step() { echo; echo "==> $*"; }
run() {
  local name="$1"; shift
  if "$@"; then echo "    PASS: $name"; else echo "    FAIL: $name"; FAILED+=("$name"); fi
}

py() {
  if [ -x "$AI/.venv/Scripts/python" ]; then "$AI/.venv/Scripts/python" "$@";
  elif [ -x "$AI/.venv/bin/python" ]; then "$AI/.venv/bin/python" "$@";
  else python "$@"; fi
}

backend() {
  step "backend"
  cd "$BACKEND"
  run "backend format" npx prettier --check "src/**/*.ts" "test/**/*.ts" "tools/**/*.ts" prisma.config.ts
  run "backend lint" npx eslint "{src,test,tools}/**/*.ts" prisma.config.ts
  run "backend typecheck" npx tsc --noEmit -p tsconfig.json
  run "prisma validate" npx prisma validate
  run "backend unit tests" npx jest
  run "backend e2e tests" npx jest --config test/jest-e2e.json
  run "openapi document up to date" npm run -s openapi:check
  run "backend build" npx nest build
  run "backend npm audit" npm audit --audit-level=high --omit=dev
}

db() {
  step "database (PostgreSQL, MongoDB, MinIO, Qdrant)"
  cd "$BACKEND"
  run "prisma validate" npx prisma validate
  run "db migrate deploy" npx prisma migrate deploy
  run "all tests incl. database (coverage >= 80%)" npx jest --config test/jest-all.json --runInBand --coverage
}

ai() {
  step "ai-services"
  cd "$AI"
  run "ai format" py -m ruff format --check .
  run "ai lint" py -m ruff check .
  run "ai typecheck" py -m mypy
  run "ai tests" py -m pytest -q --cov=app --cov-report=term --cov-fail-under=80
  if py -m pip_audit --version >/dev/null 2>&1; then run "ai pip-audit" py -m pip_audit --skip-editable --progress-spinner off; fi
}

mobile() {
  step "mobile"
  cd "$MOBILE"
  run "mobile format" dart format --output=none --set-exit-if-changed lib test
  run "mobile analyze" flutter analyze
  run "mobile tests" flutter test --coverage
  if [ "${SKIP_APK:-0}" != "1" ]; then run "mobile build apk" flutter build apk --debug; fi
}

admin_web() {
  step "admin-web"
  cd "$ADMIN_WEB"
  run "admin-web format" npm run -s format:check
  run "admin-web lint" npx oxlint --deny-warnings src
  run "admin-web typecheck" npm run -s typecheck
  run "admin-web tests" npm run -s test
  run "admin-web build" npm run -s build
  run "admin-web npm audit" npm audit --audit-level=high --omit=dev
}

secrets() {
  step "secret scan"
  cd "$ROOT"
  if command -v gitleaks >/dev/null 2>&1; then
    run "gitleaks" gitleaks detect --no-banner --redact
  else
    echo "    SKIP: gitleaks not installed (runs in CI)"
  fi
}

case "$TARGET" in
  backend) backend ;;
  db) db ;;
  ai) ai ;;
  mobile) mobile ;;
  admin-web) admin_web ;;
  all) backend; if [ "${SKIP_DB:-0}" != "1" ]; then db; fi; ai; mobile; admin_web; secrets ;;
  *) echo "unknown target $TARGET"; exit 2 ;;
esac

echo
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "QUALITY GATE FAILED: ${FAILED[*]}"; exit 1
fi
echo "QUALITY GATE PASSED ($TARGET)"
