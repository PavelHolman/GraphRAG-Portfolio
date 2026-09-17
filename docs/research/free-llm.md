# Free LLM options for the streamed Turn Answer (Effect 4 AI)

Resolves GitHub issue #20. Researched 2026-09-17 against Cloudflare Workers AI docs, Google Gemini API docs/terms, Groq docs and legal pages, OpenRouter docs and models API, Mistral docs/terms, the npm registry, and the `Effect-TS/effect` `main` branch. Companion to `docs/research/effect-ai-rc4.md` (issue #2).

Turn shape assumed throughout: ~6,000 input tokens (system prompt + graph context) and ~800 output tokens (Markdown answer with `[[id]]` markers plus the fenced `followups` block), English, streamed.

## Summary

- Default: **Cloudflare Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast`** through `@effect/ai-openai-compat@rc` pointed at the Workers AI OpenAI-compatible endpoint. It is the only free candidate with a published instruction-following score (IFEval 92.1), a no-training policy, SSE streaming, and no separate signup. The 10,000 neurons/day allocation buys ~30 Turns/day; switch to `qwen3-30b-a3b-fp8` (~190/day) or `gemma-4-26b-a4b-it` (~130/day) when volume matters.
- Fallback: **Groq `openai/gpt-oss-120b`** (30 RPM, 1,000 RPD, 8K TPM, 200K TPD free; ~29 Turns/day at 6.8K tokens each), same `openai-compat` provider, contractually no training on inputs/outputs, no retention by default.
- Gemini free tier is unattractive: prompts are used to improve Google products with human review, no `@effect/ai-google` exists on the rc line, and per-model free limits are no longer published (AI Studio dashboard only). OpenRouter `:free` is 50 requests/day and provider training policy is per-endpoint. Mistral free limits are not public.
- No `@effect/ai-*` package exists for Cloudflare, Groq, Google or Mistral on rc; everything except OpenRouter goes through `@effect/ai-openai-compat` (chat completions). `@effect/ai-openai` uses the Responses API, which Workers AI and Groq do not expose.
- Claude Sonnet remains the paid upgrade path via `@effect/ai-anthropic@rc` (already researched); the internal `LanguageModel` seam should make the swap a Layer change only.

## Findings

### 1. Effect 4 provider packages on the `rc` dist-tag (npm registry, 2026-09-17)

| Package | `rc` | `latest` | Verdict |
|---|---|---|---|
| `@effect/ai-openai` | `4.0.0-rc.115` | `0.41.0` | Responses API only; not usable against chat-completions-only hosts |
| `@effect/ai-openai-compat` | `4.0.0-rc.115` | `4.0.0-beta.107` | Chat Completions + embeddings against any OpenAI-compatible base URL |
| `@effect/ai-openrouter` | `4.0.0-rc.115` | `0.12.0` | Native OpenRouter client |
| `@effect/ai-anthropic` | `4.0.0-rc.115` | `0.27.0` | Paid upgrade path (issue #2) |
| `@effect/ai-google` | none | `0.16.0` | v3-only; no rc line |
| `@effect/ai-groq`, `@effect/ai-mistral`, `@effect/ai-cloudflare`, `@effect/ai-workers-ai` | 404 | 404 | Do not exist |

Sources: `npm view <pkg> dist-tags` for each package (https://www.npmjs.com/package/@effect/ai-openai-compat, https://www.npmjs.com/package/@effect/ai-openrouter, https://www.npmjs.com/package/@effect/ai-google); all rc packages peer on `effect@^4.0.0-rc.115`. Repo layout `packages/ai/` = `anthropic openai openai-compat openrouter` (https://github.com/Effect-TS/effect/tree/main/packages/ai).

`@effect/ai-openai-compat` README: "Connects the Effect AI modules to any OpenAI-compatible API, with support for chat completions and embeddings." Install `npm install effect@rc @effect/ai-openai-compat@rc` (https://github.com/Effect-TS/effect/blob/main/packages/ai/openai-compat/README.md). Its `OpenAiClient.layer` options are `{ apiKey?: Redacted<string>; apiUrl?: string; organizationId?; projectId?; transformClient? }`, default `apiUrl` `https://api.openai.com/v1` (https://github.com/Effect-TS/effect/blob/main/packages/ai/openai-compat/src/OpenAiClient.ts). `OpenAiLanguageModel.layer({ model: string, config? })` streams via `/chat/completions` with `stream: true` (https://github.com/Effect-TS/effect/blob/main/packages/ai/openai-compat/src/OpenAiLanguageModel.ts).

`@effect/ai-openai` (non-compat) is documented as "the OpenAI Responses API implementation of Effect AI's `LanguageModel` service" and calls `client.createResponseStream` (https://github.com/Effect-TS/effect/blob/main/packages/ai/openai/src/OpenAiLanguageModel.ts). Workers AI exposes only `/v1/chat/completions` and `/v1/embeddings` (https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/), so the compat package is the one to use.

`@effect/ai-openrouter` `OpenRouterClient.layer` options: `{ apiKey?, apiUrl? (default https://openrouter.ai/api/v1), siteReferrer?, siteTitle?, transformClient? }` (https://github.com/Effect-TS/effect/blob/main/packages/ai/openrouter/src/OpenRouterClient.ts).

### 2. Cloudflare Workers AI (free 10,000 neurons/day)

Pricing page: "Neurons are our way of measuring AI outputs across different models, representing the GPU compute needed to perform your request." "Our free allocation allows anyone to use a total of 10,000 Neurons per day at no charge." "On Workers Paid, you will be charged at $0.011 / 1,000 Neurons for any usage above the free allocation." On Workers Free, usage beyond the daily allowance is not available; Kimi, GLM and DeepSeek V4 models are only accessible "with either the Workers Paid plan or prepaid AI Gateway credits" and are therefore excluded here (https://developers.cloudflare.com/workers-ai/platform/pricing/).

Neuron cost per million tokens (input / output) from the same page, and the resulting Turns per day at 6,000 in + 800 out (neurons per Turn = in x 0.006 + out x 0.0008; floor(10,000 / that)):

| Model (`@cf/...`) | In / Out neurons per M tokens | Neurons per Turn | Turns/day | Context | Notes |
|---|---|---|---|---|---|
| `meta/llama-3.1-8b-instruct-fp8` (fast) | 4,119 / 34,868 | 52.6 | ~190 | 32,000 | IFEval 80.4 (3.1 8B card) |
| `meta/llama-3.3-70b-instruct-fp8-fast` | 26,668 / 204,805 | 323.8 | ~30 | 24,000 | IFEval 92.1; function calling |
| `meta/llama-4-scout-17b-16e-instruct` | 24,545 / 77,273 | 209.1 | ~47 | 131,000 | no IFEval published |
| `qwen/qwen3-30b-a3b-fp8` | 4,625 / 30,475 | 52.1 | ~191 | 32,768 | reasoning model; default max_tokens 2000 |
| `google/gemma-4-26b-a4b-it` | 9,091 / 27,273 | 76.4 | ~130 | 256,000 | reasoning + vision; no IFEval published |
| `openai/gpt-oss-20b` | 18,182 / 27,273 | 130.9 | ~76 | 128,000 | reasoning; Harmony format applied server-side |
| `openai/gpt-oss-120b` | 31,818 / 68,182 | 245.5 | ~40 | 128,000 | reasoning |
| `mistralai/mistral-small-3.1-24b-instruct` | 31,876 / 50,488 | 231.7 | ~43 | n/a | function calling |
| `google/gemma-3-12b-it` | 31,371 / 50,560 | 228.7 | ~43 | n/a | |
| `qwen/qwen3.8-27b` | 40,909 / 290,909 | 478.2 | ~20 | n/a | |

Caveats: reasoning models (gpt-oss, Qwen3, Gemma 4) bill their thinking tokens as output, so their real Turn cost is higher unless reasoning is set low/off; the estimate also ignores embedding calls, which share the same 10,000-neuron pool (the project already spends neurons on embeddings).

Per-model pages (context window, dollar price, capabilities): llama-3.3-70b "24,000 tokens", "$0.293 per M input tokens, $2.253 per M output tokens", "Function calling", SSE streaming, OpenAI-compatible `/v1/chat/completions` (https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/); llama-3.1-8b "32,000 tokens", "$0.152 / $0.287" (https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/); llama-4-scout "131,000 tokens", "$0.27 / $0.85" (https://developers.cloudflare.com/workers-ai/models/llama-4-scout-17b-16e-instruct/); qwen3-30b-a3b "32,768 tokens", "$0.0509 / $0.335", default max_tokens 2000 (https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/); gemma-4-26b-a4b "256,000 tokens", "$0.10 / $0.30", "Function calling, Reasoning, Vision" (https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/); gpt-oss-120b "128,000 tokens", "$0.35 / $0.75" (https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/); gpt-oss-20b "128,000 tokens", "$0.20 / $0.30" (https://developers.cloudflare.com/workers-ai/models/gpt-oss-20b/). Catalog: https://developers.cloudflare.com/workers-ai/models/.

Rate limit: text generation default "300 requests per minute" (https://developers.cloudflare.com/workers-ai/platform/limits/).

Streaming: model pages list streaming via Server-Sent Events; the OpenAI-compatible endpoint is `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1` with `Authorization: Bearer {api_token}` (https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/). The page does not state streaming explicitly for the compat endpoint; verifying `stream: true` there is an open question below.

Privacy: "Cloudflare does not use your Customer Content to (1) train any AI models made available on Workers AI or (2) improve any Cloudflare or third-party services, and would not do so unless we received your explicit consent." Content is only stored if you pair Workers AI with a storage product (https://developers.cloudflare.com/workers-ai/platform/data-usage/).

Effect path: `@effect/ai-openai-compat` `OpenAiClient.layer({ apiUrl: "https://api.cloudflare.com/client/v4/accounts/<id>/ai/v1", apiKey })` + `OpenAiLanguageModel.layer({ model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" })` + `FetchHttpClient.layer`. This goes over HTTPS rather than the `env.AI` binding; both bill the same neurons, but the REST route needs an API token secret. Wrapping the binding directly would require a custom `LanguageModel.make` implementation (open question).

### 3. Google Gemini API free tier

- Free tier exists for Gemini 3.8/3.7/3.6/3.5 Flash, 3.5/3.1 Flash-Lite, 2.5 Flash/Flash-Lite/Pro ("Free of charge"), and each free column shows "Used to improve our products: Yes" versus "No" on paid (https://ai.google.dev/gemini-api/docs/pricing).
- Terms, Unpaid Services: "human reviewers may read, annotate, and process your API input and output"; Google uses content "to provide, improve, and develop Google products and services and machine learning technologies"; "Do not submit sensitive, confidential, or personal information to the Unpaid Services." Paid Services: "Google doesn't use your prompts ... or responses to improve our products." (https://ai.google.dev/gemini-api/terms)
- Rate limits: the docs page no longer publishes per-model Free-tier RPM/TPM/RPD; it says limits "can be viewed in Google AI Studio" and links https://aistudio.google.com/rate-limit. Free tier qualification is "Active project or free trial"; Tier 1 requires a linked billing account (https://ai.google.dev/gemini-api/docs/rate-limits). A Turns/day figure therefore cannot be cited from a primary source.
- Streaming: yes via the OpenAI-compatible base URL `https://generativelanguage.googleapis.com/v1beta/openai/` with `stream=True` (https://ai.google.dev/gemini-api/docs/openai), so `@effect/ai-openai-compat` applies; there is no rc `@effect/ai-google`.
- Paid Gemini 3.8 Flash is "$0.75 through December 31, 2026" input / "$3.75" output per M tokens; 3.5 Flash-Lite "$0.30 / $2.50" (pricing page above).

### 4. Groq free plan

- Free Plan table (https://console.groq.com/docs/rate-limits): `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`: RPM 30, RPD 1K, TPM 8K, TPD 200K. `groq/compound(-mini)`: 30 RPM, 250 RPD, 70K TPM. `llama-3.3-70b-versatile` and `llama-3.1-8b-instant` do not appear in the Free Plan table as of today (they appear in the model list at https://console.groq.com/docs/models with 131,072-token context), so Llama on Groq cannot be assumed free.
- At 6,800 tokens per Turn: TPM 8K caps throughput at ~1 Turn/minute and TPD 200K caps at ~29 Turns/day; the 1K RPD is not the binding limit.
- Streaming and OpenAI compatibility: base URL `https://api.groq.com/openai/v1`; unsupported fields `logprobs`, `logit_bias`, `top_logprobs`, `messages[].name`, `N` must be 1 (https://console.groq.com/docs/openai). Paid prices: gpt-oss-120b "$0.15 input $0.60 output", gpt-oss-20b "$0.075 input $0.30 output" per M tokens (https://console.groq.com/docs/models).
- Privacy: Services Agreement 4.2: "Groq is not permitted to use Inputs or Outputs for training or fine-tuning any AI Model Services or other models, unless explicitly granted permission or instructed by Customer." (https://console.groq.com/docs/legal/services-agreement). "By default, Groq does not retain customer data for inference requests"; troubleshooting/abuse logs "up to 30 days" (https://console.groq.com/docs/your-data). The consumer privacy policy explicitly excludes GroqCloud/API Customer Data (https://groq.com/privacy-policy).

### 5. OpenRouter `:free` models

- Limits: free models are "20" requests per minute; "50" requests per day without credit purchases, "1000" per day once at least $10 of credits has ever been bought (https://openrouter.ai/docs/api-reference/limits). FAQ: "These models have low rate limits (50 requests per day total) and are usually not suitable for production use."; `openrouter/free` router exists (https://openrouter.ai/docs/faq).
- Available `:free` models today (from `GET https://openrouter.ai/api/v1/models`, filtered on `:free`): `google/gemma-4-26b-a4b-it:free`, `google/gemma-4-31b-it:free`, `z-ai/glm-5.2:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `nvidia/nemotron-3-ultra-550b-a55b:free`, `thinkingmachines/inkling:free`, `poolside/laguna-s-2.1:free`, `inclusionai/ling-3.0-flash-vl:free`, `nex-agi/nex-n2.5-pro:free`, `liquid/lfm-2.5-2.6b:free`, and others; no Llama or gpt-oss `:free` variants were listed (https://openrouter.ai/api/v1/models).
- Privacy: "Each provider on OpenRouter has its own data handling policies"; providers "that do log, or where we have been unable to confirm their policy, will not be routed to unless the model training toggle is switched on in the privacy settings tab", with separate toggles for paid and free models (https://openrouter.ai/docs/features/privacy-and-logging, https://openrouter.ai/docs/faq). Whether a given `:free` endpoint trains is per-endpoint and must be checked on the model page.
- Effect path: `@effect/ai-openrouter@rc` (native) or `@effect/ai-openai-compat` at `https://openrouter.ai/api/v1`.

### 6. Mistral La Plateforme free tier

- Docs: "Free mode lets you create API keys and use included monthly usage within the limits shown on the Limits page", pointing to the admin console (https://docs.mistral.ai/admin/user-management-finops/tier, https://admin.mistral.ai/plateforme/limits). No public numbers; the 1 RPS / 1B tokens-per-month figures circulating are secondary sources and are not cited here.
- Training: Commercial Terms 4.2: "Mistral AI will not use Customer Data or Outputs to train its artificial intelligence models except (a) when you (i) opted-in to training on a Mistral AI Product set to opt-out by default or (ii) have not opted-out of training on a Mistral AI Product set to opt-in by default"; 4.3: Labs/Preview Models may be trained on regardless of opt-out (https://legal.mistral.ai/terms/commercial-terms-of-service). Whether the free tier is "set to opt-in by default" is not stated in the terms; treat as opt-in-to-training until verified in the console.
- No rc Effect provider; Mistral's chat completions API is OpenAI-shaped, so `@effect/ai-openai-compat` at `https://api.mistral.ai/v1` is the expected path (unverified).

### 7. Instruction-following evidence (for `[[id]]` markers and the `followups` fence)

| Model | Published evidence | Source |
|---|---|---|
| Llama 3.3 70B Instruct | IFEval 92.1 (vs 3.1 70B 87.5, 3.1 8B 80.4, 3.1 405B 88.6); MMLU Pro 68.9 | https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct |
| Llama 3.1 8B Instruct | IFEval 80.4 | same card |
| Qwen3-30B-A3B-Instruct-2507 | IFEval 84.7 (vs GPT-4o 83.9, Gemini-2.5-Flash 84.3); Arena-Hard v2 69.0 | https://huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507 (Workers AI's `qwen3-30b-a3b-fp8` variant/date is not stated on its page) |
| gpt-oss-120b | No IFEval in the model card; "should only be used with the harmony format"; reasoning effort low/medium/high; chain-of-thought "not intended to be shown to end users" | https://huggingface.co/openai/gpt-oss-120b, https://arxiv.org/abs/2508.10925 |
| Gemma 4 26B A4B | No IFEval published; MMLU Pro 82.6, GPQA Diamond 82.3, 256K context | https://ai.google.dev/gemma/docs/core/model_card_4 |
| Llama 4 Scout | No IFEval published; MMLU Pro 74.3 | https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E-Instruct |

IFEval measures verifiable formatting constraints (the closest public proxy for "emit `[[id]]` inline and a trailing fenced block"). Llama 3.3 70B has the strongest published number among free-hostable models; nothing here measures citation-marker fidelity directly, so a small in-repo eval remains necessary (open question).

### 8. Comparison

| Option | Free limit (primary source) | Turns/day (6k in / 0.8k out) | Streaming | Effect AI path (rc) | Training on prompts |
|---|---|---|---|---|---|
| Workers AI Llama 3.3 70B | 10,000 neurons/day shared with embeddings; 300 RPM | ~30 | SSE | `@effect/ai-openai-compat` -> Workers AI `/ai/v1` | No (data-usage page) |
| Workers AI Qwen3 30B A3B / Gemma 4 26B / Llama 3.1 8B | same pool | ~191 / ~130 / ~190 | SSE | same | No |
| Workers AI gpt-oss-120b / 20b | same pool | ~40 / ~76 (before reasoning tokens) | SSE | same | No |
| Groq gpt-oss-120b | 30 RPM, 1K RPD, 8K TPM, 200K TPD | ~29 (TPD-bound), ~1/min | Yes | `@effect/ai-openai-compat` -> `api.groq.com/openai/v1` | No (Services Agreement 4.2); no retention by default |
| Gemini Flash free | Not published on docs page (AI Studio only) | unknown | Yes | `@effect/ai-openai-compat` -> `generativelanguage.googleapis.com/v1beta/openai/`; no `@effect/ai-google` rc | Yes, incl. human review |
| OpenRouter `:free` | 20 RPM; 50 RPD (1,000 RPD after $10 credits) | 50 (or 1,000) | Yes | `@effect/ai-openrouter@rc` | Per endpoint; toggle-gated |
| Mistral free | Not published (admin console) | unknown | Yes | `@effect/ai-openai-compat` (unverified) | Opt-in/opt-out per product; unclear for free tier |

## Recommendation

- **Default: Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast`** via `@effect/ai-openai-compat@rc` against `https://api.cloudflare.com/client/v4/accounts/<id>/ai/v1`. Highest published IFEval among candidates, explicit no-training policy, SSE streaming, no new vendor or signup, and the 24K context comfortably holds a 6K-token Turn. Budget ~30 Turns/day on the free allocation (less after embeddings); if hobby traffic exceeds that, drop to `qwen3-30b-a3b-fp8` (~190/day, IFEval 84.7 on the 2507 instruct variant) or `gemma-4-26b-a4b-it` (~130/day) with reasoning disabled, and gate by the neuron budget rather than by request count. Overage on Workers Paid costs $0.011 per 1,000 neurons, i.e. about $0.0036 per Llama 3.3 Turn.
- **Fallback: Groq `openai/gpt-oss-120b`** through the same `openai-compat` provider with only the `apiUrl`/`apiKey`/`model` swapped. Contractual no-training and no default retention; ~29 Turns/day and one Turn per minute because of the 8K TPM cap, so it is a spillover, not a co-primary. Set `reasoning_effort: low` and strip reasoning parts before rendering.
- Do not use the Gemini free tier for user-facing Turns: prompts (which contain the visitor's question) are used to improve Google products with human review. OpenRouter `:free` is fine for experiments but 50 RPD and per-endpoint training policies make it unsuitable as default.
- **Claude Sonnet stays the paid upgrade path** (`@effect/ai-anthropic@rc`, wiring already documented in `effect-ai-rc4.md`). Keep the app coded against `LanguageModel` from `effect/unstable/ai` and select the provider Layer from config so free -> Groq -> Anthropic is a Layer swap; the `[[id]]`/`followups` contract should be enforced by a post-processor regardless of provider.

## Open questions

- Confirm `stream: true` works on the Workers AI OpenAI-compatible endpoint (the compat page does not mention streaming; the model pages do for the native binding) under `wrangler dev`.
- Decide REST (`openai-compat` + API token) vs the `env.AI` binding wrapped in a custom `LanguageModel.make`; the binding avoids a secret and an extra HTTPS hop.
- Measure actual neurons per Turn from `usage`/billing rather than the list-price estimate, and reserve part of the 10,000/day pool for embeddings.
- Which Qwen3-30B-A3B snapshot Workers AI serves (thinking vs 2507 instruct) and how to disable thinking through the compat endpoint.
- Whether Groq's Free Plan table will list Llama 3.3 70B again (it does not today), and the actual free numbers for Gemini and Mistral from their consoles.
- Run a small in-repo eval of `[[id]]` marker fidelity and the trailing `followups` fence on Llama 3.3 70B, Qwen3 30B, Gemma 4 26B and gpt-oss-120b; IFEval is only a proxy.
