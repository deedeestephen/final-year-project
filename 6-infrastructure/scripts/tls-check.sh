#!/usr/bin/env bash
# Proves the reverse-proxy template enforces TLS 1.3 (NFR-01, Phase 15).
# Runs the real 2-api-gateway/reverse-proxy/nginx.conf in a throwaway Docker
# container with a temporary self-signed certificate, then:
#   - TLS 1.3 handshake succeeds; TLS 1.2 and 1.1 are refused
#   - HSTS and nosniff headers are sent
#   - plain HTTP only redirects to HTTPS
#   - any path outside /api/ is refused (404)
# Needs Docker, openssl and curl. Nothing is left behind.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DOCKER="${DOCKER:-docker}"
command -v "$DOCKER" >/dev/null 2>&1 || DOCKER="/c/Program Files/Docker/Docker/resources/bin/docker.exe"
IMAGE="${NGINX_IMAGE:-nginx:1.27-alpine}"
WORK="$(mktemp -d)"
NAME="pca-tls-check-$$"
HTTPS_PORT="${TLS_CHECK_PORT:-18443}"
HTTP_PORT="$((HTTPS_PORT + 1))"
FAILED=0

cleanup() {
  "$DOCKER" rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

pass() { echo "    PASS: $*"; }
fail() { echo "    FAIL: $*"; FAILED=1; }
winpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi; }

mkdir -p "$WORK/certs"
# (MSYS_NO_PATHCONV: Git Bash would otherwise turn "/CN=..." into a Windows
# path; the file paths are converted explicitly instead.)
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=api.example.org" \
  -keyout "$(winpath "$WORK/certs/privkey.pem")" -out "$(winpath "$WORK/certs/fullchain.pem")" >/dev/null 2>&1
# The template's backend hosts do not exist here; point them at a closed port.
sed -E 's/server api-[0-9]+:3000[^;]*;/server 127.0.0.1:9;/' \
  "$ROOT/2-api-gateway/reverse-proxy/nginx.conf" >"$WORK/nginx.conf"

MSYS_NO_PATHCONV=1 "$DOCKER" run -d --name "$NAME" \
  -p "127.0.0.1:$HTTPS_PORT:443" -p "127.0.0.1:$HTTP_PORT:80" \
  -v "$(winpath "$WORK/nginx.conf"):/etc/nginx/nginx.conf:ro" \
  -v "$(winpath "$WORK/certs"):/etc/nginx/certs:ro" \
  "$IMAGE" >/dev/null

MSYS_NO_PATHCONV=1 "$DOCKER" exec "$NAME" nginx -t >/dev/null 2>&1 && pass "nginx -t accepts the configuration" || fail "nginx -t"
for _ in $(seq 1 20); do
  (echo | openssl s_client -connect "127.0.0.1:$HTTPS_PORT" -tls1_3 >/dev/null 2>&1) && break
  sleep 0.5
done

handshake() { # $1 = openssl option; prints the negotiated protocol, or nothing when refused
  # A refused handshake reads "New, (NONE), Cipher is (NONE)" (the "Protocol:"
  # line then only shows the version that was attempted, so it is not used).
  echo | openssl s_client -connect "127.0.0.1:$HTTPS_PORT" -servername api.example.org "$1" 2>/dev/null \
    | awk '/^New, / { if ($2 != "(NONE),") { sub(",", "", $2); print $2 }; exit }'
}

[ "$(handshake -tls1_3)" = "TLSv1.3" ] && pass "TLS 1.3 handshake succeeds" || fail "TLS 1.3 handshake"
[ -z "$(handshake -tls1_2)" ] && pass "TLS 1.2 is refused" || fail "TLS 1.2 was accepted"
[ -z "$(handshake -tls1_1)" ] && pass "TLS 1.1 is refused" || fail "TLS 1.1 was accepted"

headers="$(curl -sk -D - -o /dev/null --resolve "api.example.org:$HTTPS_PORT:127.0.0.1" "https://api.example.org:$HTTPS_PORT/api/v1/health" || true)"
echo "$headers" | grep -qi '^strict-transport-security: max-age=31536000; includeSubDomains' \
  && pass "HSTS header (1 year, subdomains)" || fail "HSTS header missing"
echo "$headers" | grep -qi '^x-content-type-options: nosniff' && pass "nosniff header" || fail "nosniff header missing"
echo "$headers" | grep -qi '^server: nginx/' && fail "nginx version is disclosed" || pass "server version not disclosed"

outside="$(curl -sk -o /dev/null -w '%{http_code}' --resolve "api.example.org:$HTTPS_PORT:127.0.0.1" "https://api.example.org:$HTTPS_PORT/etc/passwd" || true)"
[ "$outside" = "404" ] && pass "paths outside /api/ are refused (404)" || fail "path outside /api/ answered $outside"

redirect="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H 'Host: api.example.org' "http://127.0.0.1:$HTTP_PORT/api/v1/health" || true)"
case "$redirect" in
  "301 https://api.example.org/api/v1/health") pass "plain HTTP redirects to HTTPS" ;;
  *) fail "plain HTTP answered: $redirect" ;;
esac

echo
if [ "$FAILED" -ne 0 ]; then echo "TLS CHECK FAILED"; exit 1; fi
echo "TLS CHECK PASSED"
