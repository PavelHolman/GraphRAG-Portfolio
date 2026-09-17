# Observability and analytics spec

Decisions from [Decide: observability and analytics event model](https://github.com/PavelHolman/GraphRAG/issues/13). Vendor-neutral by design: everything is OpenTelemetry over OTLP/HTTP JSON, so the backend (Grafana Cloud or a self-hosted stack, decided separately) is one configuration value. Deploy target per ADR 0006. Vocabulary per `CONTEXT.md`.

## Principles

- **Never log Prompt or Answer text.** A pasted job description can name people and companies. Node and Edge ids, counts, lengths and categories are fine: they are the owner's own content.
- **No cookies, no user id.** The browser session id is a random value in `sessionStorage`, per tab, gone when the tab closes.
- **One wire, any backend.** Server and browser both speak OTLP/HTTP JSON to a single `OTEL_EXPORTER_OTLP_ENDPOINT`; changing backend changes that value and the auth header.

## Server (Cloudflare Worker, Effect)

- **Layer**: `@effect/opentelemetry` `Otlp.layerJson({ baseUrl, headers })` over `FetchHttpClient.layer`, provided once in the SvelteKit server hooks. Resource attributes: `service.name=graphrag-web`, `service.version` (git sha), `deployment.environment` (preview or production).
- **Platform layer**: wrangler `observability.traces.destinations` and `observability.logs.destinations` point at the same endpoint (JSON only) for request-level spans and console logs, `persist: false`. Application spans and logs come from Effect; the two correlate through the W3C trace context the platform propagates.
- **Trace per Turn**: root span `turn`, children `classify`, `embed`, `seed`, `expand`, `budget`, `generate`, `parse`, via `Effect.withSpan`. No per-chunk spans.
- **Span attributes** (`turn` unless noted): `turn.id`, `turn.mode` ∈ match|entity|hybrid, `prompt.length_tokens`, `prompt.category` ∈ job-description|skill|project|education|general|off-topic (heuristic), `prompt.source` ∈ typed|hint|followup, `history.turns`, `seed.count`, `candidate.nodes`, `candidate.edges`, `used.nodes`, `used.edges`, `embedding.model` (on `embed`), `llm.model`, `llm.tokens_in`, `llm.tokens_out`, `llm.first_token_ms` (on `generate`), `error.tag` on failure.
- **Logs**: every request at `info` (route, method, status, duration, cold start), Effect logs at `info` and above from every service, `warn` and above always. The indexer's CI run exports its own spans (`index`, `validate`, `embed`, `layout`) and logs to the same endpoint with `service.name=graphrag-index`.

## Browser (OpenTelemetry web SDK)

- `@opentelemetry/sdk-trace-web` + OTLP/HTTP exporters for traces and logs, batched, flushed on `visibilitychange`. Resource: `service.name=graphrag-browser`, `session.id`, `device.class` ∈ phone|tablet|desktop (viewport plus touch), `webgl.available`, `prefers_reduced_motion`.
- The Turn fetch carries `traceparent`, so browser and server spans join on one trace.
- **Analytics events** are OTel log records with `event.name` and attributes:

| `event.name` | Attributes |
|---|---|
| `visit` | device class, viewport class, webgl available, reduced motion, referrer host |
| `hint_shown` | hint id |
| `prompt_submitted` | source ∈ typed|hint|followup, length bucket ∈ short|medium|long|jd |
| `turn_finished` | turn id, duration ms, citations count, mode |
| `turn_error` | turn id, error tag |
| `citation_clicked` | turn id, node type, via ∈ inline|chip |
| `scene_interacted` | first orbit or pan, seconds since load |
| `section_viewed` | section id, once per visit |
| `link_clicked` | target ∈ cv|github|linkedin |

- **Measurement**: `scene.fps` as a gauge (metrics OTLP) sampled every 10 s while the tab is visible, with `device.class`.
- Browser logs: only errors and unhandled rejections. Lifecycle is covered by the events above.

## Retention and region

14 days per signal is sufficient. EU region or EU-hosted VPS. Monthly aggregates, if wanted later, come from dashboard panels, not from longer raw retention.

## Backend

Decided in [Decide: observability backend (self-hosted or Grafana Cloud)](https://github.com/PavelHolman/GraphRAG/issues/24) after the self-hosted research. Grafana Cloud Free is the known-good stopgap; nothing above depends on it.

## Rejected

Grafana Faro in the browser (ties the browser side to Grafana; web vitals are replaced by a small library and session replay is not needed); logging every Turn event as browser logs (duplicates the analytics events); span per LLM chunk (noise); cookies or persistent user ids.
