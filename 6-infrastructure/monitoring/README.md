# Monitoring and alerting (planned)

Not built yet. What exists today:
- health endpoints: `GET /api/v1/health` (alive) and `GET /api/v1/health/ready` (databases reachable, AI service state)
- structured JSON request logs with request ids (pino), with identifiers and secrets redacted
- rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`)

When deployed:
- **Prometheus:** request rate, latency percentiles, error rate, rate-limit rejections, AI job duration and failures
- **Grafana:** one dashboard per layer
- **Alerts:** when availability or latency targets are missed, and when AI jobs keep failing
