# Turn endpoint hardening spec

Decisions from [Decide: public Turn endpoint hardening](https://github.com/PavelHolman/GraphRAG/issues/22). Deploy per ADR 0006, wire per ADR 0003, pipeline per ADR 0004, observability per `docs/spec/observability.md`.

## Order of checks

Every check below runs before any paid call, in this order: input limits → per-IP rate limit → per-session limit → daily budget → embed → generate.

## Input limits (request schema in `packages/schema`)

| Field | Limit | Error tag |
|---|---|---|
| `prompt` | 8,000 characters | `input-too-large` |
| `history` | 3 Turns, 6,000 characters total | `input-too-large` |
| `previousUsedIds` | 60 ids, each must exist in the artifact | `input-invalid` |

The client pre-checks with the same schema; the server rejects with a terminal `error` event naming the limit.

## Rate limits

- **Per IP** via the Workers Rate Limiting binding: 6 Turns per minute and 60 per hour.
- **Per session** (`session.id` from the browser) in the budget Durable Object: 40 Turns per UTC day.
- Both return `error` with tag `rate-limited`, `retryable: true`, `retryAfterSeconds`.

## Daily budget and degradation

One Durable Object (`TurnBudget`) holds per-UTC-day counters. Budget is counted in **estimated neurons**, not requests, because embeddings share Workers AI's 10,000 free neurons per day.

| Pool | Allocation |
|---|---|
| Embeddings (query-time) | 2,000 neurons |
| Turns | 8,000 neurons |

- Turns 0 to 60% of the Turn pool: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
- 60% to 100%: `@cf/qwen/qwen3-30b-a3b-fp8` with reasoning disabled (about six times cheaper per Turn).
- Past 100%, or embeddings pool spent: terminal `error` with tag `budget-exhausted`, `retryable: false`, `resetAt` (next UTC midnight). The caption says the assistant is resting until then; the Sections stay fully usable.
- The neuron estimate per Turn is `tokens_in × 0.006 + tokens_out × 0.0008` per the pricing page, reconciled against `usage` when the provider returns it. `turn-started` carries a `tier` field (`primary | economy`) so the caption can label economy Answers if wanted.

The model switch is a `LanguageModel` layer selection in retrieval's pool service; no other code changes.

## Bot mitigation

Cloudflare Bot Fight Mode (free) plus the limits above. No Turnstile. Hook point recorded: the endpoint reads an optional `cf-turnstile-response` header and the schema has an optional field for it, both ignored until enabled. Prompt injection is handled by the system prompt and the eval case, not at the edge.

## Abuse logging (no PII)

Per Turn, as span attributes and one `info` log: IP hash (SHA-256 with a salt rotated daily, so correlation works within a day and never across days), `session.id`, country, ASN, Prompt length, `prompt.category`, budget tier and remaining, rate-limit decision. Never the Prompt text. Retention 14 days.

## Deferred

A degradation ladder beyond Workers AI (Groq, OpenRouter free, Mistral free, then a retrieval-only templated Answer with no LLM) and lexical BM25 seeding to make retrieval free of embedding calls are captured in [Research: free capacity pool and zero-cost fallbacks](https://github.com/PavelHolman/GraphRAG/issues/26), **deferred until the owner asks**. Nothing above blocks adding them: the pool service gains providers, and `budget-exhausted` becomes the last rung instead of a wall.

## Rejected (for now)

Paying overage on Workers Paid; Turnstile on the Turn endpoint; KV counters (eventual consistency); request-count budgets (ignore embeddings and model mix).
