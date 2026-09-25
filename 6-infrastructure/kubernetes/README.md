# Kubernetes (planned)

Not built yet. There is no cluster to test manifests against, and untested manifests would give a false sense of readiness.

When a deployment target is chosen:
- one Deployment each for `backend` (several replicas), `ai-services` and the admin website (or serve the website from a CDN)
- readiness probe `GET /api/v1/health/ready`, liveness probe `GET /api/v1/health`
- a HorizontalPodAutoscaler on CPU and requests per second
- secrets from the platform's secret store, never from files in the image
- managed PostgreSQL, MongoDB, Redis and object storage, not in-cluster databases

See [`../README.md`](../README.md) for the whole deployment plan.
