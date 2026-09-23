#!/usr/bin/env bash
# Quality gate: format -> lint -> type-check -> tests -> build -> audits, for every package.
# Usage: scripts/quality-gate.sh [backend|ai|mobile|all]   (default: all)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-all}"
FAILED=()

step() { echo; echo "==> $*"; }
run() {
  local name="$1"; shift
  if "$@"; then echo "    PASS: $name"; else echo "    FAIL: $name"; FAILED+=("$name"); fi
}

py() {
  if [ -x "$ROOT/ai-services/.venv/Scripts/python" ]; then "$ROOT/ai-services/.venv/Scripts/python" "$@";
  elif [ -x "$ROOT/ai-services/.venv/bin/python" ]; then "$ROOT/ai-services/.venv/bin/python" "$@";
  else python "$@"; fi
}

backend() {
  step "backend"
  cd "$ROOT/backend"
  run "backend format" npx prettier --check "src/**/*.ts" "test/**/*.ts"
  run "backend lint" npx eslint "{src,test}/**/*.ts"
  run "backend typecheck" npx tsc --noEmit -p tsconfig.json
  if [ -f prisma/schema.prisma ]; then run "prisma validate" npx prisma validate; fi
  run "backend unit tests" npx jest --coverage
  run "backend e2e tests" npx jest --config test/jest-e2e.json --runInBand
  run "backend build" npx nest build
  run "backend npm audit" npm audit --audit-level=high --omit=dev
}

ai() {
  step "ai-services"
  cd "$ROOT/ai-services"
  run "ai format" py -m ruff format --check .
  run "ai lint" py -m ruff check .
  run "ai typecheck" py -m mypy
  run "ai tests" py -m pytest -q --cov=app --cov-report=term --cov-fail-under=80
  if py -m pip_audit --version >/dev/null 2>&1; then run "ai pip-audit" py -m pip_audit --skip-editable --progress-spinner off; fi
}

mobile() {
  step "mobile"
  cd "$ROOT/mobile"
  run "mobile format" dart format --output=none --set-exit-if-changed lib test
  run "mobile analyze" flutter analyze
  run "mobile tests" flutter test --coverage
  if [ "${SKIP_APK:-0}" != "1" ]; then run "mobile build apk" flutter build apk --debug; fi
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
  ai) ai ;;
  mobile) mobile ;;
  all) backend; ai; mobile; secrets ;;
  *) echo "unknown target $TARGET"; exit 2 ;;
esac

echo
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "QUALITY GATE FAILED: ${FAILED[*]}"; exit 1
fi
echo "QUALITY GATE PASSED ($TARGET)"
