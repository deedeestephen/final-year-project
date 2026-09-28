#!/usr/bin/env bash
# Checks the FHIR export format with the official HL7 FHIR validator (FHIR R4).
#
#   6-infrastructure/scripts/fhir-validate.sh            full check: codes and their
#                                                        wording are checked on the HL7
#                                                        terminology server (tx.fhir.org)
#   6-infrastructure/scripts/fhir-validate.sh --offline  structure and definitions only
#
# Needs Java 11+ and the validator jar (not in the repository, about 200 MB):
#   D:\Final Year Project\tools\fhir-validator\validator_cli.jar
# from https://github.com/hapifhir/org.hl7.fhir.core/releases (check its SHA-256).
# Override with FHIR_VALIDATOR_JAR and JAVA. The sample is built from made-up
# values only (npm run fhir:sample); no database is touched.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND="$ROOT/3-application-logic/backend"
DEFS="$ROOT/2-api-gateway/fhir/definitions"
JAR="${FHIR_VALIDATOR_JAR:-$ROOT/../tools/fhir-validator/validator_cli.jar}"
OUT="$ROOT/var/fhir-sample/sample-bundle.json"

find_java() {
  if [ -n "${JAVA:-}" ]; then echo "$JAVA"; return; fi
  if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ]; then echo "$JAVA_HOME/bin/java"; return; fi
  if command -v java >/dev/null 2>&1; then echo java; return; fi
  for jbr in "/c/Program Files/Android/Android Studio3/jbr/bin/java.exe" \
             "/c/Program Files/Android/Android Studio/jbr/bin/java.exe"; do
    if [ -x "$jbr" ]; then echo "$jbr"; return; fi
  done
  return 1
}

if [ ! -f "$JAR" ]; then echo "FHIR validator not found at $JAR" >&2; exit 3; fi
JAVA_BIN="$(find_java)" || { echo "Java not found" >&2; exit 3; }

TX=()
if [ "${1:-}" = "--offline" ]; then TX=(-tx n/a); fi

(cd "$BACKEND" && npm run -s fhir:sample -- "$OUT" >/dev/null)
echo "Validating $OUT"
# The validator exits non-zero when it reports any error.
"$JAVA_BIN" -Xmx2g -jar "$JAR" "$OUT" -version 4.0.1 -ig "$DEFS" "${TX[@]}"
