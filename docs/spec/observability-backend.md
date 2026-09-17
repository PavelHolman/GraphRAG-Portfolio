# Observability backend runbook

Decisions from [Decide: observability backend (self-hosted or Grafana Cloud)](https://github.com/PavelHolman/GraphRAG/issues/24). Event model per `docs/spec/observability.md`; research in the `research/self-hosted-observability` branch.

## Decision

- **Target**: self-hosted **OpenObserve** (open-source edition), one instance for all the owner's projects, one organisation per project.
- **Stopgap**: **Grafana Cloud Free** until the VPS exists. The wire is identical; switching is one endpoint and one header. No Grafana-specific dashboards are built meanwhile.
- **Browser telemetry never talks to the backend directly.** It posts OTLP JSON to the site's own `/api/telemetry` route, which checks the origin, applies the per-IP rate limit, drops unknown `event.name` values, and forwards with the server-side credential. Backend CORS and browser-held secrets are therefore non-issues.

## Endpoint configuration (per environment)

| Setting | Grafana Cloud (now) | OpenObserve (later) |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `https://otlp-gateway-<eu-region>.grafana.net/otlp` | `https://o11y.<domain>/api/graphrag` |
| `OTEL_EXPORTER_OTLP_HEADERS` | `Authorization=Basic <instanceId:token>` | `Authorization=Basic <ingest-user:password>` |
| Cloudflare exporter destinations | traces → `<endpoint>/v1/traces`, logs → `<endpoint>/v1/logs`, same header | same shape, one destination per signal per project |
| Resource | `service.namespace=graphrag`, `service.name` ∈ graphrag-web \| graphrag-index \| graphrag-browser | same |

Secrets live in wrangler secrets (runtime) and GitHub Actions secrets (indexer run).

## VPS layout (OpenObserve)

- EU VPS, 2 to 4 GB RAM, Docker Compose.
- Services: `openobserve` pinned to an exact image tag; `caddy` for TLS and the hostname, proxying to 5080.
- Environment: `ZO_ROOT_USER_EMAIL`, `ZO_ROOT_USER_PASSWORD`, `ZO_DATA_DIR=/data`, `ZO_COMPACT_DATA_RETENTION_DAYS=14`, `ZO_MEM_TABLE_MAX_SIZE` capped for the box.
- Volume `/data` on persistent disk; nightly snapshot of `/data` to object storage with 30 days of snapshots.
- One organisation per project, each with an ingest-only user; the root user is never used for ingest.
- Measurement week: after first deploy, record RSS and `/data` growth daily for seven days before pointing other projects at it.

## Migration steps (Grafana Cloud → OpenObserve)

1. Provision per the wizard task; verify a test span and log record arrive in the `graphrag` org.
2. Update the two wrangler secrets and the Actions secrets; redeploy.
3. Repoint the Cloudflare exporter destinations in the dashboard.
4. Rebuild the four panels (Turns per day by tier, errors by tag, p50/p95 `llm.first_token_ms`, events by `event.name`) as SQL panels in OpenObserve.
5. Leave Grafana Cloud in place for 14 days, then remove its credentials.

## Rejected

SigNoz (4 GB floor, tenancy behind enterprise; fallback if the query builder ever matters more than isolation); HyperDX (single team in OSS, 3-day default TTL); Grafana LGTM self-hosted (five components, no ingest auth without a proxy); Uptrace (three databases, no small sizing); OpenObserve's own RUM SDK (keep the OTel web SDK); browser sending directly to the backend (public credential).
