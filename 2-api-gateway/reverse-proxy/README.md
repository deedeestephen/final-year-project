# Reverse proxy (TLS 1.3, routing, load balancing)

`nginx.conf` is a **template for deployment**. Local development talks to the backend directly on `http://localhost:3000`, and the phone emulator on `http://10.0.2.2:3000`, which is allowed only in debug builds.

What it does:
- **TLS 1.3 only**, with HSTS. Plain HTTP only redirects to HTTPS.
- **Load balancing:** `/api/` goes to several stateless backend instances (`least_conn`). Rate-limit counters are shared through Redis (see `docs/scalability.md`).
- **Routing:** nothing but `/api/` is exposed on the API host. The admin website is served as static files on its own host.
- **Uploads:** request buffering is off, so imaging and slide files stream straight to the backend, which enforces the size limits.

**Check the syntax** without deploying. It needs Docker, and makes a throwaway self-signed certificate inside the container. From the repository root, in PowerShell:
```
docker run --rm --add-host api-1:127.0.0.1 --add-host api-2:127.0.0.1 -v "${PWD}/2-api-gateway/reverse-proxy/nginx.conf:/etc/nginx/nginx.conf:ro" nginx:1.27-alpine sh -c "mkdir -p /etc/nginx/certs && apk add --no-cache openssl >/dev/null && openssl req -x509 -newkey rsa:2048 -nodes -subj /CN=test -keyout /etc/nginx/certs/privkey.pem -out /etc/nginx/certs/fullchain.pem -days 1 2>/dev/null && nginx -t"
```
→ `syntax is ok` / `test is successful` (checked 2026-09-25). The `--add-host` entries stand in for the backend instances, which must resolve when nginx starts.

Before a real deployment:
- replace the server names and certificate paths
- point the upstream at the real instances
- decide who manages the certificates (for example Let's Encrypt)
