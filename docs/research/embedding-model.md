# Research: embedding model for build-time (Bun) and query-time (Cloudflare)

Resolves GitHub issue #3. Sources fetched 2026-09-17; all figures below are quoted from the provider's own docs, pricing pages or model cards at that date.

## Summary

- Recommend **Cloudflare Workers AI `@cf/baai/bge-base-en-v1.5`** (768-d, 512-token input, $0.067/M tokens, 3,000 req/min). One model, one API, usable from Bun via the REST endpoint and from a Pages Function via the `AI` binding; the whole corpus plus all realistic query traffic fits in the 10,000 free neurons/day.
- Fallback: **Voyage AI `voyage-4-lite`** (256/512/1024/2048-d, 32k context, $0.02/M tokens, 200M free tokens, 2,000 RPM) called over plain HTTPS from both places, with `input_type: "query"|"document"`.
- OpenAI `text-embedding-3-small` is a viable third option ($0.02/M, 1536-d truncatable) but adds nothing over Voyage and its Free tier is 100 RPM.
- A local model via transformers.js under Bun is rejected: it rules out running the same model at query time on Workers (128 MB isolate, no native addons) and Bun has a history of segfault/crash issues with `onnxruntime-node`.
- Whatever is chosen, the query-side and document-side pooling/instruction settings must be identical at both call sites; that is the only real footgun.

## Findings

### Requirements restated

- Build time: a few hundred short technical Markdown nodes, embedded from a Bun 1.4 script. Rate limits and batch size barely matter at this volume; a couple of hundred nodes at ~200 tokens each is ~50k tokens, i.e. fractions of a cent on every paid API.
- Query time: one visitor prompt or a pasted job description (a few hundred to ~2k tokens), embedded inside a Cloudflare Pages Function / Worker. Latency, cold start and Worker resource limits dominate.
- The same model must produce both vectors, or nearest-neighbour search is meaningless.

### Cloudflare Workers AI

Catalog of text-embedding models: `@cf/baai/bge-small-en-v1.5` (384-d), `@cf/baai/bge-base-en-v1.5` (768-d), `@cf/baai/bge-large-en-v1.5` (1024-d), `@cf/baai/bge-m3`, `@cf/google/embeddinggemma-300m`, `@cf/qwen/qwen3-embedding-0.6b`, `@cf/pfnet/plamo-embedding-1b` (Japanese). Source: https://developers.cloudflare.com/workers-ai/models/

`bge-base-en-v1.5` model page: "768" dimensional output, max input tokens "512", "$0.0666 per M input tokens", batch "Yes", `text` accepts "a string or array of strings", pooling default is mean with an optional `cls`; "cls pooling will generate more accurate embeddings on larger inputs - however, embeddings created with cls pooling are not compatible with embeddings generated with mean pooling." Source: https://developers.cloudflare.com/workers-ai/models/bge-base-en-v1.5/

- `bge-small-en-v1.5`: "384" dims, 512 tokens, "$0.0202 per M input tokens". Source: https://developers.cloudflare.com/workers-ai/models/bge-small-en-v1.5/
- `bge-large-en-v1.5`: "1,024" dims, 512 tokens, "$0.204 per M input tokens". Source: https://developers.cloudflare.com/workers-ai/models/bge-large-en-v1.5/
- `bge-m3`: "$0.0118 per M input tokens", takes `text` or a `query` + `contexts[]` pair; the Cloudflare page does not state dimensions. Source: https://developers.cloudflare.com/workers-ai/models/bge-m3/ . The upstream model card states 1024 dims, 8192-token input, 100+ languages, MIT licence. Source: https://huggingface.co/BAAI/bge-m3
- `qwen3-embedding-0.6b`: 8,192 context, "$0.0118 per M input tokens", optional `instruction` param. Source: https://developers.cloudflare.com/workers-ai/models/qwen3-embedding-0.6b/ . Model card: dims "ranging from 32 to 1024", MTEB multilingual 64.33, Apache-2.0. Source: https://huggingface.co/Qwen/Qwen3-Embedding-0.6B
- `embeddinggemma-300m`: Cloudflare page has no specs; model card: 768-d with Matryoshka 512/256/128, 2048-token context, requires prompt templates `task: search result | query: {content}` and `title: none | text: {content}`. Source: https://huggingface.co/google/embeddinggemma-300m

Pricing: "10,000 Neurons per day at no charge", then "$0.011 / 1,000 Neurons"; bge-base is "6058 neurons per M input tokens". Source: https://developers.cloudflare.com/workers-ai/platform/pricing/ . Consequence: ~1.65M bge-base tokens/day are free, i.e. the whole corpus plus thousands of queries per day cost nothing.

Rate limits: Text Embeddings "3000 requests per minute" (bge-large: 1500). Source: https://developers.cloudflare.com/workers-ai/platform/limits/

Callable from Bun (outside a Worker) via REST: `https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{model}` with `Authorization: Bearer {API_TOKEN}`; token needs "Workers AI - Read" and "Workers AI - Edit". Source: https://developers.cloudflare.com/workers-ai/get-started/rest-api/ . There is also an OpenAI-compatible `/v1/embeddings` endpoint at `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1`. Source: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/

Callable from a Pages Function via a Workers AI binding (dashboard: Settings > Bindings > Workers AI; local dev `wrangler pages dev --ai AI`). "Using Workers AI always accesses your Cloudflare account ... and will incur usage charges even in local development." Source: https://developers.cloudflare.com/pages/functions/bindings/

Batch API (async, queue + poll, payload < 10 MB) is available for the three `bge-*-en-v1.5` models. Sources: https://developers.cloudflare.com/workers-ai/features/batch-api/ , https://developers.cloudflare.com/workers-ai/models/?capabilities=Batch . Not needed at a few hundred nodes; the synchronous array input is enough.

Upstream model card for bge-base-en-v1.5: 768-d, 512 max sequence, MTEB 63.55, MIT licence, recommended query instruction "Represent this sentence for searching relevant passages:", L2-normalise before cosine. Source: https://huggingface.co/BAAI/bge-base-en-v1.5

Vectorize (if used as the store): max "1536 dimensions", free plan "5 million stored vector dimensions" and "30 million queried vector dimensions / month". Sources: https://developers.cloudflare.com/vectorize/platform/limits/ , https://developers.cloudflare.com/vectorize/platform/pricing/ . A few hundred 768-d vectors is ~0.3M stored dims, well within free.

### Voyage AI

Models: `voyage-4-large`, `voyage-4`, `voyage-4-lite`, `voyage-3.5`, `voyage-3.5-lite`, `voyage-code-3`, `voyage-3-large`; all 32,000-token context, default 1024-d, `output_dimension` 256/512/1024/2048, `output_dtype` float/int8/uint8/binary/ubinary. `input_type: "query"` / `"document"` prepends "Represent the query for retrieving supporting documents" / "Represent the document for retrieval". Source: https://docs.voyageai.com/docs/embeddings

Pricing: `voyage-4-large` "$0.12", `voyage-4` "$0.06", `voyage-4-lite` "$0.02" per million tokens, each with "200 million" free tokens. Source: https://docs.voyageai.com/docs/pricing

Rate limits (Tier 1): `voyage-4-lite`/`voyage-3.5-lite` 16M TPM / 2000 RPM; `voyage-4`/`voyage-3.5` 8M TPM / 2000 RPM; `voyage-4-large` 3M TPM / 2000 RPM. "Rate Limits increase to 2x Tier 1 at Tier 2 (>=$100 paid) and 3x Tier 1 at Tier 3 (>=$1000 paid)". Source: https://docs.voyageai.com/docs/rate-limits

API: `POST https://api.voyageai.com/v1/embeddings`; up to 1,000 texts per request; per-request token caps "1M for voyage-4-lite and voyage-3.5-lite", "320K for voyage-4, voyage-3.5", "120K for voyage-4-large ..."; `truncation` defaults to true. Source: https://docs.voyageai.com/reference/embeddings-api

Plain HTTPS + API key, so it works identically from Bun and from a Worker (`fetch`). No published latency figures.

### OpenAI text-embedding-3

`text-embedding-3-small`: 1536-d, max input 8192, MTEB "62.3%"; `text-embedding-3-large`: 3072-d, 8192, "64.6%"; both accept a `dimensions` parameter to shorten. Source: https://developers.openai.com/api/docs/guides/embeddings

Pricing: `text-embedding-3-small` "Input $0.02", `text-embedding-3-large` "Input $0.13", `ada-002` "$0.10" per 1M tokens. Source: https://developers.openai.com/api/docs/pricing

Rate limits for `text-embedding-3-small`: Free 100 RPM / 40,000 TPM; Tier 1 3,000 RPM / 1,000,000 TPM; Tier 5 10,000 RPM / 10,000,000 TPM. Source: https://developers.openai.com/api/docs/models/text-embedding-3-small

Note: 3072-d `text-embedding-3-large` exceeds Vectorize's 1536-d cap unless `dimensions` is reduced.

### Local model via transformers.js / ONNX under Bun

transformers.js (`@huggingface/transformers`) runs server-side on "Node.js version 18+" using ONNX Runtime; the docs describe Node.js only and do not mention Bun. Sources: https://huggingface.co/docs/transformers.js/tutorials/node , https://huggingface.co/docs/transformers.js/index . Xenova ships ONNX weights for bge-base-en-v1.5 used as `extractor(texts, { pooling: 'mean', normalize: true })`. Source: https://huggingface.co/Xenova/bge-base-en-v1.5

Bun lists Node-API in its Node.js compatibility table (https://bun.com/docs/runtime/nodejs-apis), but the native `onnxruntime-node` path has a track record of crashes on Bun: segfaults (https://github.com/oven-sh/bun/issues/4619 , https://github.com/oven-sh/bun/issues/6089 , https://github.com/oven-sh/bun/issues/6848), an ONNX session-handler error on Bun 1.1.13 (https://github.com/oven-sh/bun/issues/11825), a Windows path regression in 1.2.5 (https://github.com/oven-sh/bun/issues/18079, closed with a fix), and a `bun test` C++ crash on 1.3.6 (https://github.com/oven-sh/bun/issues/26081, closed Jan 2026). Most are closed, but the pattern means a local model is a maintenance liability, not a free win.

The decisive point is query time: a Worker isolate has "128 MB of memory, including the JavaScript heap and WebAssembly allocations" and 64 MiB script size; Free plan CPU is "10 ms" per request. Source: https://developers.cloudflare.com/workers/platform/limits/ . A ~100 MB bge-base ONNX model run via WASM does not fit that budget, so a local model at build time forces a *different* runtime (Workers AI) at query time anyway. That only works if it is byte-for-byte the same model with the same pooling; Cloudflare's `bge-base-en-v1.5` and Xenova's ONNX export are both derived from `BAAI/bge-base-en-v1.5`, but nothing in either doc guarantees identical outputs, so mixing them is an unverified risk.

### Comparison

| Option | Same model both places | Dims / max input | Quality signal (MTEB, provider-reported) | Cost for ~50k build tokens + 10k queries/mo (~1k tok) | Query-time call from Worker | Rate limit |
|---|---|---|---|---|---|---|
| CF Workers AI `bge-base-en-v1.5` | Yes: REST from Bun, `AI` binding from Pages | 768 / 512 tok | 63.55 (model card) | $0 (10k free neurons/day; ~$0.0007 otherwise) | Binding, no egress | 3,000 RPM |
| CF Workers AI `bge-m3` | Yes | 1024 (model card) / 8192 tok | multilingual, 100+ langs | $0 | Binding | 3,000 RPM |
| CF Workers AI `qwen3-embedding-0.6b` | Yes | 32-1024 (model card) / 8192 tok | 64.33 multilingual (model card) | $0 | Binding | 3,000 RPM |
| Voyage `voyage-4-lite` | Yes: HTTPS from both | 256-2048 (default 1024) / 32k tok | provider's "latency and cost" tier | $0 (200M free), then $0.02/M | `fetch` to api.voyageai.com | 2,000 RPM / 16M TPM |
| Voyage `voyage-4` | Yes | 256-2048 / 32k | provider's general-purpose tier | $0 (200M free), then $0.06/M | `fetch` | 2,000 RPM / 8M TPM |
| OpenAI `text-embedding-3-small` | Yes: HTTPS from both | 1536 (truncatable) / 8192 tok | 62.3% | ~$0.0012/mo | `fetch` to api.openai.com | Free 100 RPM; Tier 1 3,000 RPM |
| OpenAI `text-embedding-3-large` | Yes | 3072 (truncatable) / 8192 tok | 64.6% | ~$0.008/mo | `fetch` | as above |
| Local transformers.js bge-base under Bun | No: cannot run in a Worker (128 MB, 10 ms CPU free) | 768 / 512 tok | 63.55 | $0 | Not possible; must call Workers AI anyway | n/a |

Cost is negligible for every hosted option; the differentiators are operational (one vendor vs two, binding vs egress, free-tier headroom) and input length.

## Recommendation

**Primary: `@cf/baai/bge-base-en-v1.5` on Workers AI.**

- Build script (Bun): `POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/baai/bge-base-en-v1.5` with `{ "text": [ ...nodes ] }`, in arrays of a few dozen nodes. Query (Pages Function): `env.AI.run("@cf/baai/bge-base-en-v1.5", { text: prompt })`.
- Why base rather than small/large: 768-d sits under Vectorize's 1536 cap with room, costs 3x small but still lands inside the free 10k neurons/day, and large is 3x the price for a 1024-d vector with half the RPM.
- Constraints to bake in: input is capped at 512 tokens, so a pasted job description must be chunked (or truncated to roughly its first 350 words) before embedding; use the default mean pooling on both sides and never mix in `cls`; L2-normalise and use cosine.
- Why not bge-m3 / qwen3 on Workers AI: they lift the 512-token limit and are cheaper, but the Cloudflare pages do not document their output dimensions or batch support, and the corpus is English technical text where bge-base is the best-documented choice. bge-m3 is the in-vendor upgrade path if the 512-token cap bites.

**Fallback: Voyage AI `voyage-4-lite`** at `output_dimension: 1024` (or 512 to save Vectorize dims), `input_type: "document"` at build and `"query"` at query time. Reasons: 32k-token context removes the chunking requirement, 200M free tokens covers the project indefinitely, and it is a plain HTTPS call that behaves the same in Bun and in a Worker. Cost of switching later: re-embed the corpus (seconds).

## Open questions

1. Latency: none of the three providers publishes p50/p95 embedding latency. Measure a Workers AI binding call vs a Voyage `fetch` from a deployed Pages Function before committing to a UX budget.
2. Whether `@cf/baai/bge-base-en-v1.5` should be called with the model card's query instruction ("Represent this sentence for searching relevant passages:") prepended to queries; the model card says v1.5 works "without instruction", Cloudflare's page does not mention it. Decide once and apply consistently.
3. Chunking strategy for job descriptions longer than 512 bge tokens (embed chunks and max-pool the similarity, or switch to bge-m3 / Voyage). Depends on how the search is scored.
4. Vector store: Vectorize free tier (5M stored dims, 30M queried dims/month) is sufficient, but a few hundred vectors could equally be shipped as static JSON and searched in-Worker; not decided here.
5. Workers AI does not document output dimensions for `bge-m3`, `qwen3-embedding-0.6b` or `embeddinggemma-300m`; verify empirically before using any of them.
