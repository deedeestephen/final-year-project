# Layer 6: Infrastructure

| Part of the diagram | Folder | Status |
|---|---|---|
| Docker containerisation | [`docker/docker-compose.yml`](docker/docker-compose.yml): PostgreSQL, MongoDB, Redis, MinIO, Qdrant for development | Built (development) |
| Developer and quality tools | [`scripts/`](scripts/): `dev-up.ps1` / `dev-down.ps1` (start and stop everything), `quality-gate.sh` (all checks), `gen-keys.mjs` (secrets), `phone-usb.ps1` | Built |
| Kubernetes orchestration, auto-scaling, load balancer | [`kubernetes/`](kubernetes/) | Planned (deployment) |
| Prometheus monitoring, Grafana dashboards, SLA alerting | [`monitoring/`](monitoring/) | Planned (deployment) |
| Cloud (AWS / Azure), WAF and DDoS protection, CDN, data residency, disaster recovery | this README (below) | Planned (deployment) |

## Deployment plan (not built in this prototype)
- **Containers:** backend, AI service and admin website each get their own image. The backend is stateless, so several copies can run behind the load balancer (`2-api-gateway/reverse-proxy/`).
- **Kubernetes:** a Deployment per service with health probes (`/api/v1/health`, `/api/v1/health/ready`), and a HorizontalPodAutoscaler on CPU and request rate.
- **Monitoring:** Prometheus scraping request counts, latency and rate-limit rejections; Grafana dashboards; alerts when availability or latency targets are missed.
- **Edge:** a WAF and DDoS protection in front of the load balancer. The admin website and app downloads are served from a CDN.
- **Data residency and disaster recovery:** databases and backups stay in an approved region; there is a documented restore procedure, tested regularly (see `5-data-persistence/backup-recovery/`).

These are described, not faked: no manifests or dashboards exist until there is a deployment target to test them on. Measured capacity so far: [docs/scalability.md](../docs/scalability.md).
