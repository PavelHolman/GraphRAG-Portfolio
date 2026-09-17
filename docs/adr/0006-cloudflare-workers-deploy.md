---
status: accepted
---

# Deploy to Cloudflare Workers with static assets, not Pages

Charting settled on Cloudflare Pages, but research showed that Cloudflare's platform OpenTelemetry exporter, Workers Logs, and its own guidance for new projects are all Workers-only, and Pages offers nothing the project needs in return. `apps/web` deploys as a **Cloudflare Worker with static assets** through `@sveltejs/adapter-cloudflare`; the precomputed graph artifact ships as static assets on the same Worker.

- **Workers AI**: the `AI` binding at runtime (embeddings via a binding-backed Effect service; the language model through `@effect/ai-openai-compat` over the account REST endpoint until a binding-backed adapter is written). The Bun indexer, which has no binding, uses the REST endpoint with an API token.
- **CI and deploys**: GitHub Actions runs indexer, lint, typecheck and tests, then `wrangler versions upload` for a preview URL on pull requests and `wrangler deploy` on the default branch. Workers Builds' GitHub integration is not used because the pipeline must run the indexer first.
- **State**: the Workers Rate Limiting binding for per-IP limits and a single Durable Object for the daily cost counter. No KV. The endpoint hardening ticket sets the numbers.
- **Secrets** (Anthropic key, Workers AI token for build, OTLP credentials) live in wrangler secrets and GitHub Actions secrets; `wrangler.jsonc` sits in `apps/web`.

Rejected: staying on Pages (loses platform telemetry and is the legacy path); Workers Builds (cannot run the indexer before deploy); KV for counters (eventually consistent).
