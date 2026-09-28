#!/usr/bin/env bash
# Quality gate: format -> lint -> type-check -> tests -> build -> audits, for every package.
# Usage: scripts/quality-gate.sh [backend|db|ai|mobile|admin-web|fhir|tls|secrets|all]   (default: all)
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
  run "FHIR definitions up to date" npm run -s fhir:definitions:check
  run "access matrix up to date and within the review rules" npm run -s access:matrix:check
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
  # Known vulnerabilities in the Dart/Flutter packages (OSV); skipped when offline.
  local status=0
  py "$ROOT/6-infrastructure/scripts/pub-audit.py" >/tmp/pca-pub-audit.log 2>&1 || status=$?
  if [ "$status" -eq 3 ]; then echo "    SKIP: mobile package audit (OSV not reachable)"
  elif [ "$status" -eq 0 ]; then echo "    PASS: mobile package audit (OSV)"
  else cat /tmp/pca-pub-audit.log; echo "    FAIL: mobile package audit (OSV)"; FAILED+=("mobile package audit"); fi
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

fhir() {
  step "FHIR conformance (HL7 validator)"
  # Offline (structure and local definitions); the full check with the HL7
  # terminology server is: 6-infrastructure/scripts/fhir-validate.sh
  local status=0
  bash "$ROOT/6-infrastructure/scripts/fhir-validate.sh" --offline >/tmp/pca-fhir-validate.log 2>&1 || status=$?
  if [ "$status" -eq 3 ]; then
    echo "    SKIP: HL7 validator or Java not installed (see docs/fhir-export.md)"
  elif [ "$status" -eq 0 ]; then
    echo "    PASS: FHIR sample export validates ($(grep -E '^(Success|\*FAILURE\*)' /tmp/pca-fhir-validate.log | head -1))"
  else
    grep -E '^\s+Error @|^(Success|\*FAILURE\*)' /tmp/pca-fhir-validate.log | head -20
    echo "    FAIL: FHIR sample export validates"; FAILED+=("fhir validator")
  fi
}

tls() {
  step "TLS 1.3 at the reverse proxy (nginx in Docker)"
  if docker info >/dev/null 2>&1 || "/c/Program Files/Docker/Docker/resources/bin/docker.exe" info >/dev/null 2>&1; then
    run "reverse proxy: TLS 1.3 only, HSTS, HTTP redirect" bash "$ROOT/6-infrastructure/scripts/tls-check.sh"
  else
    echo "    SKIP: Docker is not running"
  fi
}

secrets() {
  step "secret scan"
  cd "$ROOT"
  # On PATH, or in the tools folder next to the project (D:\Final Year Project\tools).
  local gl=""
  if command -v gitleaks >/dev/null 2>&1; then gl="gitleaks"
  elif [ -x "$ROOT/../tools/gitleaks/gitleaks.exe" ]; then gl="$ROOT/../tools/gitleaks/gitleaks.exe"
  fi
  if [ -n "$gl" ]; then
    # Scans the whole git history. Reviewed false positives are listed,
    # one exact finding per line, in .gitleaksignore.
    run "gitleaks (full history)" "$gl" git --no-banner --redact .
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
  secrets) secrets ;;
  fhir) fhir ;;
  tls) tls ;;
  all) backend; if [ "${SKIP_DB:-0}" != "1" ]; then db; fi; ai; mobile; admin_web; fhir; tls; secrets ;;
  *) echo "unknown target $TARGET"; exit 2 ;;
esac

echo
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "QUALITY GATE FAILED: ${FAILED[*]}"; exit 1
fi
echo "QUALITY GATE PASSED ($TARGET)"
