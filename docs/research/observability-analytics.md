# Research: OpenObserve or alternatives for observability + visitor analytics

Resolves GitHub issue #6. Researched 2026-09-17 against primary sources only (vendor docs, pricing pages, package source).

## Summary

- OpenObserve can do both jobs: OTLP HTTP ingest for Effect traces/logs, plus a first-party browser RUM SDK with Sessions / Performance / Errors / Session Replay dashboards.
- Every candidate except Highlight.io accepts OTLP over plain HTTP, so Cloudflare Workers (fetch only) and browsers can reach them; Highlight.io redirects to LaunchDarkly and was sunset on 2026-02-28, so it is out.
- Hobby-scale cost: OpenObserve Cloud has only a 14-day trial then $0.50/GB; Grafana Cloud Free (50 GB logs + 50 GB traces + 50k Faro sessions/mo), PostHog (1M events + 5k replays + 10 GB logs/mo, EU cloud) and Axiom (500 GB/mo, EU region) are free forever.
- Privacy: Grafana Faro and PostHog `cookieless_mode` are cookieless by design; OpenObserve RUM is cookie-based (Datadog-derived SDK); Grafana Cloud, PostHog and Axiom all offer EU (Frankfurt) hosting.
- Recommendation: Grafana Cloud Free (OTLP gateway + Faro) as the single backend; self-hosted OpenObserve is the fallback if you want one AGPL binary you control. Details below.

## Findings

### 1. Emitting telemetry from Effect on Cloudflare Workers and the browser

- `@effect/opentelemetry` documents `NodeSdk.layer(...)` with `BatchSpanProcessor(new OTLPTraceExporter())` from `@opentelemetry/exporter-trace-otlp-http`, and mentions `WebSdk` for browsers, but gives no browser example. Source: https://effect.website/docs/observability/tracing/
- The package (v0.64.1) also ships an `Otlp` module that does not need the OTel JS SDK at all. `Otlp.layer({ baseUrl, headers?, resource? })` merges `OtlpLogger`, `OtlpMetrics` and `OtlpTracer` and posts to `baseUrl + "/v1/logs" | "/v1/metrics" | "/v1/traces"` through `@effect/platform` `HttpClient`; `Otlp.layerJson` / `Otlp.layerProtobuf` pick the encoding. Providing `FetchHttpClient.layer` makes it fetch-only, which is exactly what Workers and browsers offer. Source: `src/Otlp.ts` in the npm tarball https://registry.npmjs.org/@effect/opentelemetry/-/opentelemetry-0.64.1.tgz (lines 23-68); module index at https://effect-ts.github.io/effect/docs/opentelemetry
- Cloudflare Workers additionally has platform-level OTel export: `observability.traces.destinations` / `observability.logs.destinations` in wrangler config, destination URL + custom headers set in the dashboard, `persist: false` to make the third party the sole store. "Cloudflare does not support the Binary format for OTLP ingest" (so JSON only for the platform exporter). Workers Traces is in early beta with pricing starting 2026-10-01; custom spans are supported. Sources: https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/ and https://developers.cloudflare.com/workers/observability/traces/
- Caveat for this project: the app targets Cloudflare Pages. Cloudflare's Pages-to-Workers migration matrix lists Workers Logs, Logpush, Tail Workers and Source Maps as Workers-only, and Cloudflare's static-assets docs say new projects should use Workers instead of Pages. The platform OTel exporter is therefore a Workers feature; on Pages, use the Effect `Otlp` layer (app-level fetch) instead. Sources: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/ and https://developers.cloudflare.com/workers/static-assets/
- Workers Logs (Cloudflare-native, no OTel) free plan: 200,000 events/day, 3-day retention. Source: https://developers.cloudflare.com/workers/observability/logs/workers-logs/

### 2. OpenObserve

Ingest
- OTLP HTTP endpoints: `https://<host>/api/<org>/v1/traces`, `/v1/logs`, `/v1/metrics`; auth `Authorization: Basic base64(email:password)`; gRPC also available on port 5081 (not needed). Sources: https://openobserve.ai/docs/ingestion/traces/opentelemetry/ and https://openobserve.ai/docs/ingestion/logs/otlp/
- With Effect: `Otlp.layerJson({ baseUrl: "https://<host>/api/<org>", headers: { Authorization: "Basic ..." } })` lines up with these paths.

Product analytics (RUM)
- Browser SDK `@openobserve/browser-rum` + `@openobserve/browser-logs`; init takes `clientToken`, `applicationId`, `site`, `organizationIdentifier`, `service`, `env`, `version`, `insecureHTTP`, `apiVersion`, `sessionSampleRate`, `sessionReplaySampleRate`, `trackingConsent`, `beforeSend`. Dashboards: Performance, Sessions, Error Tracking, Session Replay, filterable by source (browser/Android/iOS). Source: https://openobserve.ai/docs/user-guide/data-exploration/rum/setup/
- Custom data API: `setGlobalContextProperty`, `setViewContext`, `addTiming(name, duration)`, `setUser`, `startSessionReplayRecording`, `setTrackingConsent`. Suitable for "prompt asked", "turn number", "scene fps" as context properties/timings. Source: https://openobserve.ai/docs/user-guide/data-exploration/rum/advanced-features/
- Consent: `trackingConsent: 'granted' | 'not-granted'` at init and `setTrackingConsent()` at runtime; `sessionReplaySampleRate: 0` recommended by default. Source: https://openobserve.ai/docs/user-guide/data-exploration/rum/best-practices/
- Cookies: session tracking is cookie-based; the troubleshooting guide exposes `useCrossSiteSessionCookie` and `useSecureSessionCookie` and tells you to check cookies are not blocked. Replay masking uses `data-dd-privacy` attributes (the SDK is Datadog-derived). Not cookieless. Sources: https://openobserve.ai/docs/user-guide/data-exploration/rum/troubleshooting-guide/ and https://openobserve.ai/docs/user-guide/data-exploration/rum/best-practices/
- Dashboards are SQL/PromQL panels with variables, tabs and folders. No funnel, retention or path insight types are documented; product questions become hand-written SQL over the RUM streams. Source: https://openobserve.ai/docs/user-guide/dashboards/

Cost and hosting
- Cloud: 14-day trial, then $0.50/GB ingested, $0.01/GB queried, 30-day retention for logs/traces/RUM, unlimited users. No permanent free tier. Source: https://openobserve.ai/pricing
- Cloud regions include EU-Central 1 (Frankfurt), launched 2026-03-16. Source: https://openobserve.ai/whats-new/2026-03-16-eu-central-region/
- Self-host: OSS edition is AGPL-3.0, "free forever"; Enterprise edition free up to 50 GB/day. Single binary or one `docker run -v $PWD/data:/data -p 5080:5080 ...`; local disk via `ZO_DATA_DIR`, or S3-compatible storage via `ZO_S3_*` (aws, gcs, minio, ...). No published minimum RAM/CPU; `ZO_MEM_TABLE_MAX_SIZE` defaults to 50 % of host memory. Sources: https://openobserve.ai/pricing, https://openobserve.ai/docs/quickstart/, https://openobserve.ai/docs/environment-variables/, https://github.com/openobserve/openobserve
- Realism for a solo project: yes. A single-node container with a mounted volume is the documented quickstart; the operational cost is a VPS, backups of `/data`, TLS in front of port 5080, and upgrades. The RUM endpoint and OTLP endpoint must be publicly reachable from browsers and from Cloudflare.

### 3. Grafana Cloud (Tempo/Loki + Faro)

- OTLP gateway `https://otlp-gateway-<region>.grafana.net/otlp` with `/v1/traces`, `/v1/logs`, `/v1/metrics`, `Authorization: Basic <instanceId:token>`; Cloudflare's own Workers export guide targets this URL. Sources: https://grafana.com/docs/grafana-cloud/send-data/otlp/send-data-otlp/ and https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/grafana-cloud/
- Free tier: 50 GB logs + 50 GB traces per month, 10k metric series, 50k Frontend Observability sessions per month, 14-day retention, 3 active users, no credit card. Source: https://grafana.com/pricing/
- Faro Web SDK: web vitals, errors, logs, client traces; "Faro doesn't store or use any cookies"; session id in `sessionStorage` (or `localStorage` when `persistent: true`), 4 h max / 15 min idle, `samplingRate` 0-1; IPs used only transiently for geo and not stored. Sources: https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/settings-and-policies/data-privacy/ and https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/instrument/session-tracking/
- Analytics dashboards: sessions view plus general Grafana panels over Loki/Tempo; device class comes from Faro's browser metadata, custom events/measurements carry app data. Not a funnel/retention product.
- EU: OTLP gateway region is chosen at stack creation (`prod-eu-west-*` etc. per the gateway naming in the OTLP docs).

### 4. PostHog (+ OTel)

- Free monthly allowance: 1M events, 5k session replays, 100k exceptions, 10 GB logs. Source: https://posthog.com/pricing
- EU Cloud: independent instance in AWS eu-central-1 (Frankfurt); public endpoint `https://eu.i.posthog.com`. Source: https://posthog.com/blog/posthog-cloud-eu
- Distributed tracing: OTLP over HTTP at `https://us.i.posthog.com/i/v1/traces`, `Authorization: Bearer <phc_ project token>`, accepts `application/x-protobuf` and `application/json`; explicitly "in beta. Setup details, including the ingestion endpoint, may change". No EU trace endpoint documented yet. Sources: https://posthog.com/docs/distributed-tracing and https://posthog.com/docs/distributed-tracing/start-here
- Logs via OpenTelemetry are documented separately. Source: https://posthog.com/docs/logs/installation
- Privacy: `cookieless_mode: 'always' | 'on_reject'` ("PostHog sets no cookies and uses no session or local storage"), `persistence: 'memory'`, `person_profiles: 'identified_only'`. Source: https://posthog.com/docs/libraries/js/config
- Best product-analytics UI of the set (trends, funnels, retention, paths, replay), but traces are beta and the two halves are not correlated the way an OTel-native backend correlates them.

### 5. Axiom

- OTLP HTTP at `https://<AXIOM_DOMAIN>/v1/traces|logs|metrics`, `Authorization: Bearer <token>`, `X-Axiom-Dataset: <dataset>`; metrics endpoint is protobuf-only. Cloudflare's Workers export guide uses `https://api.axiom.co/v1/traces`. Sources: https://axiom.co/docs/send-data/opentelemetry and https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/axiom/
- Regions: `us-east-1.aws.edge.axiom.co` and `eu-central-1.aws.edge.axiom.co` (EU residency for ingest, storage, query). Source: https://axiom.co/docs/reference/regions
- Personal tier: 500 GB/mo ingest, 30-day retention, 25 GB storage, 10 GB-hours query, "Permanent. No credit card required." Source: https://axiom.co/pricing
- Product analytics: no general browser RUM/session SDK. Web Vitals capture is limited to Next.js via `next-axiom` ("expanded support is coming soon"). Visitor sessions would have to be modelled as events you post yourself. Source: https://axiom.co/docs/apps/vercel

### 6. Highlight.io

- `highlight.io` and `/pricing` now 308-redirect to `https://launchdarkly.com/`. LaunchDarkly acquired Highlight on 2025-04-21; Highlight's migration post states services were deprecated on 2026-02-28 and SDK snippets had to move to LaunchDarkly Observability. Not a candidate. Sources: https://launchdarkly.com/blog/welcome-highlight-to-launchdarkly/ and https://nodejs.highlight.io/blog/launchdarkly-migration

### Comparison table

| Criterion | OpenObserve (Cloud / self-host) | Grafana Cloud Free + Faro | PostHog Cloud | Axiom | Highlight.io |
|---|---|---|---|---|---|
| OTLP HTTP reachable via fetch (Workers + browser) | Yes: `/api/<org>/v1/{traces,logs,metrics}`, Basic auth | Yes: `/otlp/v1/{traces,logs,metrics}`, Basic auth; official Cloudflare guide | Yes for traces (beta) and logs; Bearer token | Yes: `/v1/{traces,logs,metrics}`; official Cloudflare guide | Sunset |
| Effect `Otlp.layerJson` fit | Direct (baseUrl = `/api/<org>`) | Direct (baseUrl = `.../otlp`) | Traces only; path is `/i/v1/traces`, not `/v1/traces`, so use `OtlpTracer.layer` with explicit url | Direct | n/a |
| Hobby cost | Cloud: 14-day trial, then $0.50/GB. Self-host: free (AGPL) + VPS | Free forever: 50 GB logs, 50 GB traces, 50k sessions/mo, 14-day retention | Free forever: 1M events, 5k replays, 10 GB logs/mo | Free forever: 500 GB/mo, 30-day retention | n/a |
| Product analytics dashboards | RUM Sessions/Performance/Errors/Replay + SQL panels; no funnels/retention | Frontend Observability sessions + Grafana panels; no funnels/retention | Trends, funnels, retention, paths, replay (best) | None built in; SQL-style queries over events | n/a |
| Cookieless by default | No (cookie session; consent option) | Yes (web storage only, no cookies) | Opt-in `cookieless_mode` | n/a (no SDK) | n/a |
| EU hosting / self-host | EU-Central 1 cloud; self-host anywhere | EU stacks (region chosen at signup); OSS Grafana/Tempo/Loki self-hostable | EU Cloud (Frankfurt); self-host is hobby-only | eu-central-1 edge | n/a |
| Solo self-host realistic | Yes: one binary / one container, local disk or S3 | Not needed (free tier); self-hosting LGTM stack is heavier | Not recommended by PostHog for prod | No self-host | n/a |

## Recommendation

Use Grafana Cloud Free as the single backend for both concerns, with Faro for the browser.

- It is the only option that is free forever, cookieless out of the box, EU-hostable, and correlates frontend sessions with backend traces in one place. 50 GB traces + 50 GB logs + 50k sessions per month is far above hobby scale.
- Backend: `Otlp.layerJson({ baseUrl: "https://otlp-gateway-<region>.grafana.net/otlp", headers: { Authorization: "Basic ..." } })` provided with `FetchHttpClient.layer` in the SvelteKit server hooks on Cloudflare. If the project later moves from Pages to Workers, the wrangler `observability` destination can replace or supplement this with zero code.
- Product analytics questions (sessions, prompts asked, turns, mobile vs desktop, scene fps): send them as Faro custom events/measurements (`faro.api.pushEvent(name, attrs)`, `faro.api.pushMeasurement({ type, values })`, source: https://github.com/grafana/faro-web-sdk/blob/main/docs/sources/tutorials/quick-start-browser.md) with the session id; device class comes from Faro's browser meta. Query in Grafana over Loki with the Frontend Observability app. Accept that funnels/retention will be hand-built panels.
- If you specifically want a funnel/retention UI, add PostHog EU (cookieless mode) for product analytics only and keep traces in Grafana; do not rely on PostHog's beta trace endpoint as the observability store.
- Choose self-hosted OpenObserve instead only if data ownership in a single AGPL binary outweighs running a VPS, or if you outgrow Grafana's 14-day retention. It ticks every box functionally (OTLP HTTP, RUM, EU or self-host) but its RUM is cookie-based and its Cloud has no free tier.

## Open questions

- Is the app staying on Cloudflare Pages? Cloudflare positions Workers as the target for new projects and gates platform-level OTel export and Workers Logs to Workers; moving would simplify export.
- Faro custom events for "scene frame rate": confirm whether a periodic `pushMeasurement` at hobby volume stays inside the 50k sessions / 50 GB logs allowance (it should, but volume depends on sampling interval).
- Grafana Cloud EU region name for the OTLP gateway should be read off the stack once created; the docs only show the `<REGION>` placeholder.
- PostHog's EU trace endpoint is undocumented while tracing is in beta; re-check before relying on it.
- OpenObserve RUM cookie name and lifetime are not documented; if OpenObserve is chosen, inspect the SDK to write the cookie notice.
