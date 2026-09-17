# Effect AI + Anthropic provider on the Effect 4 RC line

Resolves GitHub issue #2. Researched 2026-09-17 against npm registry metadata, the published RC tarballs, the `Effect-TS/effect` `main` branch, and effect.website v4 API docs.

## Summary

- On Effect 4 there is **no `@effect/ai` package**: the core AI modules live inside `effect` at `effect/unstable/ai` (`LanguageModel`, `Prompt`, `Response`, `Chat`, `Tool`, `Toolkit`, `AiError`, ...). `@effect/ai` stops at `0.37.0` and peers on `effect@^3.22`.
- The Anthropic provider is still a separate package: `@effect/ai-anthropic@4.0.0-rc.115` (dist-tag `rc`), peer `effect@^4.0.0-rc.115`. Install with `npm i effect@rc @effect/ai-anthropic@rc`.
- Streaming is `LanguageModel.streamText({ prompt })` returning `Stream<Response.StreamPart<Tools>, AiError, LanguageModel>`; parts are tagged unions (`text-delta`, `tool-call`, `tool-result`, `finish`, ...).
- Provider wiring is three layers: `FetchHttpClient.layer` (from `effect/unstable/http`) -> `AnthropicClient.layer`/`layerConfig` -> `AnthropicLanguageModel.layer({ model })` (or the `AnthropicLanguageModel.model(...)` value).
- It is Workers-safe: the HTTP transport is `globalThis.fetch`, SSE decoding is in core with no `node:` imports, and rc.113 specifically fixed a Cloudflare Workers global-scope timer issue. A minimal streaming example typechecks against rc.115 (below).

## Findings

### 1. Package names and versions

| Package | dist-tag `rc` | dist-tag `latest` | Notes |
|---|---|---|---|
| `effect` | `4.0.0-rc.115` (also `beta` = `4.0.0-beta.107`) | `3.22.2` | AI modules included at `effect/unstable/ai` |
| `@effect/ai` | none | `0.37.0` | v3-only; peers `effect@^3.22.0`, `@effect/platform@^0.97.0` |
| `@effect/ai-anthropic` | `4.0.0-rc.115` | `0.27.0` | RC peers `effect@^4.0.0-rc.115` only (no `@effect/platform`, no `@effect/ai`) |
| `@effect/platform` | none | `0.97.2` | Not needed on v4; HTTP moved to `effect/unstable/http` |

Sources:
- `npm view effect dist-tags` -> `{ latest: 3.22.2, rc: 4.0.0-rc.115, beta: 4.0.0-beta.107 }` (https://www.npmjs.com/package/effect?activeTab=versions)
- `npm view @effect/ai dist-tags` -> `{ latest: 0.37.0 }`, no `rc`; `npm view @effect/ai@latest peerDependencies` -> `effect ^3.22.0` (https://www.npmjs.com/package/@effect/ai)
- `npm view @effect/ai-anthropic dist-tags` -> `{ latest: 0.27.0, rc: 4.0.0-rc.115, beta: 4.0.0-beta.107 }`; `npm view @effect/ai-anthropic@rc peerDependencies` -> `{ effect: "^4.0.0-rc.115" }` (https://www.npmjs.com/package/@effect/ai-anthropic)
- `npm view effect@rc exports` includes `"./unstable/ai": "./dist/unstable/ai/index.js"` and `"./unstable/http"`.
- Repo layout on `main` (default branch): `packages/` = `ai atom effect opentelemetry platform sql tools vitest`; `packages/ai/` = `anthropic openai openai-compat openrouter` (no `packages/ai/ai`); core AI sources at `packages/effect/src/unstable/ai/` (https://github.com/Effect-TS/effect/tree/main/packages/effect/src/unstable/ai and https://github.com/Effect-TS/effect/tree/main/packages/ai). The v3 code lives on the `v3` branch.
- README on main: "npm install effect@rc @effect/ai-anthropic@rc" (https://github.com/Effect-TS/effect/blob/main/packages/ai/anthropic/README.md)
- effect.website v4 API index lists `Unstable > Ai` modules under `/docs/v4/api/effect/unstable/ai/*` (https://effect.website/docs/v4/api/effect); provider docs at https://effect.website/docs/v4/api/ai-anthropic (version shown: 4.0.0-rc.115).

Note on naming: the issue says "RC4"; the RC line is `4.0.0-rc.N` (currently rc.115, published 2026-09-11). There is no separate "rc4" tag.

### 2. Import paths (rc.115)

```ts
import { Config, Effect, Layer, Stream } from "effect"
import { LanguageModel, Prompt, Response, Chat, Tool, Toolkit, AiError } from "effect/unstable/ai"
import { FetchHttpClient, HttpClient } from "effect/unstable/http"
import { AnthropicClient, AnthropicLanguageModel, AnthropicConfig, AnthropicTool } from "@effect/ai-anthropic"
```

`effect/unstable/ai/index.ts` re-exports: `AiError, AnthropicStructuredOutput, Chat, EmbeddingModel, IdGenerator, LanguageModel, McpProtocol, McpSchema, McpServer, Model, OpenAiStructuredOutput, Prompt, Response, ResponseIdTracker, Telemetry, Tokenizer, Tool, Toolkit` (https://github.com/Effect-TS/effect/blob/main/packages/effect/src/unstable/ai/index.ts).

`@effect/ai-anthropic` index re-exports: `AnthropicClient, AnthropicConfig, AnthropicError, AnthropicLanguageModel, AnthropicTelemetry, AnthropicTool, Generated` (https://github.com/Effect-TS/effect/blob/main/packages/ai/anthropic/src/index.ts). Subpath imports like `@effect/ai-anthropic/AnthropicClient` also work (`exports["./*"]`).

### 3. Streaming API shape

`LanguageModel.streamText` (https://github.com/Effect-TS/effect/blob/main/packages/effect/src/unstable/ai/LanguageModel.ts, docs: https://effect.website/docs/v4/api/effect/unstable/ai/LanguageModel):

```ts
streamText(options: { prompt: Prompt.RawInput; toolkit?; toolChoice?; concurrency?; disableToolCallResolution? })
  : Stream.Stream<Response.StreamPart<Tools, ParametersMode>, ExtractError<Options>, ExtractServices<Options> | LanguageModel>
```

- `Prompt.RawInput = string | Iterable<MessageEncoded> | Prompt` (https://github.com/Effect-TS/effect/blob/main/packages/effect/src/unstable/ai/Prompt.ts).
- `Response.StreamPart` is a tagged union on `part.type`: `text-start | text-delta | text-end | reasoning-start | reasoning-delta | reasoning-end | tool-params-start | tool-params-delta | tool-params-end | tool-call | tool-result | tool-approval-request | file | source | response-metadata | finish | error` (https://github.com/Effect-TS/effect/blob/main/packages/effect/src/unstable/ai/Response.ts).
  - `TextDeltaPart { type: "text-delta"; id: string; delta: string }`
  - `ToolCallPart { type: "tool-call"; id; name; params; providerExecuted: boolean }`, `ToolResultPart` success/failure, `FinishPart` with `Usage`.
- Error channel is `AiError.AiError` (union incl. `NetworkError, RateLimitError, AuthenticationError, InvalidRequestError, ToolNotFoundError, ...`) (https://github.com/Effect-TS/effect/blob/main/packages/effect/src/unstable/ai/AiError.ts).
- Tool calls: pass `toolkit` (built from `Tool.make` + `Toolkit.make`); by default tool calls are resolved in-stream and emitted as `tool-call` then `tool-result` parts (`disableToolCallResolution` turns that off).
- Non-streaming counterparts: `generateText` and `generateObject`; multi-turn state via `Chat` (`Chat.empty`, `Chat.fromPrompt`, `chat.streamText`) (https://github.com/Effect-TS/effect/blob/main/packages/effect/src/unstable/ai/Chat.ts).

### 4. Provider as a Layer

From https://github.com/Effect-TS/effect/blob/main/packages/ai/anthropic/src/AnthropicClient.ts and `.../AnthropicLanguageModel.ts`:

- `AnthropicClient.layer(options: { apiKey?: Redacted<string>; apiUrl?; apiVersion?; transformClient? }): Layer<AnthropicClient, never, HttpClient.HttpClient>`
- `AnthropicClient.layerConfig({ apiKey?: Config<Redacted<string> | undefined>, ... }): Layer<AnthropicClient, ConfigError, HttpClient.HttpClient>`
- `AnthropicLanguageModel.layer({ model, config? }): Layer<LanguageModel.LanguageModel, never, AnthropicClient>`
- `AnthropicLanguageModel.model(model, config?): Model<"anthropic", LanguageModel, AnthropicClient>` (a `Model.make(...)` value usable with `Effect.provide`/`Stream.provide`, also exposing `Model.ProviderName`/`ModelName`)
- The client needs `HttpClient.HttpClient`; on v4 the fetch transport is `FetchHttpClient.layer: Layer<HttpClient>` from `effect/unstable/http` (https://github.com/Effect-TS/effect/blob/main/packages/effect/src/unstable/http/FetchHttpClient.ts). Default API URL `https://api.anthropic.com`, header `x-api-key`, `anthropic-version: 2023-06-01`; the low-level service also exposes `createMessageStream` (SSE via `effect/unstable/encoding/Sse`).

v4 API renames observed while typechecking: `Config.Redacted("NAME")` (capitalised; `Config.redacted` no longer exists), `Stream.provide(layer)` (no `Stream.provideLayer`), `Stream.toReadableStreamEffect()` is called with an options object then applied via `pipe`.

### 5. Minimal streaming example (typechecks against effect@4.0.0-rc.115 + @effect/ai-anthropic@4.0.0-rc.115, TS strict, lib DOM)

```ts
import { Config, Effect, Layer, Stream } from "effect"
import { LanguageModel } from "effect/unstable/ai"
import { FetchHttpClient } from "effect/unstable/http"
import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic"

// fetch HttpClient -> AnthropicClient -> LanguageModel
const Anthropic = AnthropicClient.layerConfig({
  apiKey: Config.Redacted("ANTHROPIC_API_KEY")
}).pipe(Layer.provide(FetchHttpClient.layer))

const Claude = AnthropicLanguageModel.layer({ model: "claude-sonnet-4-5" }).pipe(
  Layer.provide(Anthropic)
)

// Stream<string, AiError, never>
export const textDeltas = (question: string) =>
  LanguageModel.streamText({ prompt: question }).pipe(
    Stream.filter((part) => part.type === "text-delta"),
    Stream.map((part) => part.delta),
    Stream.provide(Claude)
  )

// SvelteKit +server.ts / Workers: hand the browser a Web ReadableStream
export const toResponse = (question: string) =>
  Effect.gen(function* () {
    const body = yield* textDeltas(question).pipe(
      Stream.encodeText,
      Stream.toReadableStreamEffect()
    )
    return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } })
  })
```

Verified with `tsc --noEmit` in a scratch project (`npm i effect@rc @effect/ai-anthropic@rc`, resolved to rc.115 for both). On Cloudflare Pages the API key should come from `platform.env` rather than `process.env`; use `AnthropicClient.layer({ apiKey: Redacted.make(env.ANTHROPIC_API_KEY) })` or a `ConfigProvider` built from `platform.env` instead of `layerConfig`.

### 6. Cloudflare Workers compatibility

- `FetchHttpClient` module doc: "the transport to use in browsers, edge runtimes, and Node.js environments where `globalThis.fetch` is available"; implementation calls `fiber.getRef(Fetch)` defaulting to `globalThis.fetch`, sends stream bodies with `duplex: "half"` (https://github.com/Effect-TS/effect/blob/main/packages/effect/src/unstable/http/FetchHttpClient.ts).
- Grep of the published rc.115 tarball: no `node:` imports in `dist/unstable/ai/**`, `dist/unstable/http/FetchHttpClient.js`, `dist/unstable/http/HttpClient.js`, or `dist/unstable/encoding/Sse.js`; `@effect/ai-anthropic` sources import only `effect/*` and have no `node:` imports and no `engines` field.
- `effect@4.0.0-rc.113` changelog, PR #7930: "The default scheduler falls back to a microtask when setting a timer throws. Cloudflare Workers disallow timers in global scope..." (https://github.com/Effect-TS/effect/blob/main/packages/effect/CHANGELOG.md, https://github.com/Effect-TS/effect/pull/7930). This is direct evidence the maintainers test/support Workers on the RC line; pin rc.113 or later.
- No "Node-only" dependency is pulled in: `@effect/ai-anthropic@rc` has zero `dependencies`, only the `effect` peer.

## Recommendation

- Depend on `effect@^4.0.0-rc.115` and `@effect/ai-anthropic@^4.0.0-rc.115`; do not add `@effect/ai` or `@effect/platform` (v3-only, would cause duplicate-runtime/type conflicts).
- Import core AI from `effect/unstable/ai` and HTTP from `effect/unstable/http`; wire `FetchHttpClient.layer -> AnthropicClient.layer(Config/Redacted) -> AnthropicLanguageModel.layer({ model })`.
- Stream answers with `LanguageModel.streamText`, filter `part.type === "text-delta"`, `Stream.encodeText` + `Stream.toReadableStreamEffect()` into a `Response` from a SvelteKit `+server.ts` on Cloudflare Pages.
- Since `unstable/ai` is explicitly unstable, wrap the provider behind a small internal `LanguageModel`-typed service so RC-to-RC API renames stay localised; pin exact versions and bump `effect` and `@effect/ai-anthropic` together (their peer ranges are locked per-RC).

## Open questions

- No v4 narrative guide for AI exists on effect.website yet (only API reference pages; `/docs/v4/ai` returns 404); expect churn until 4.0.0 stable.
- Runtime verification on `workerd` (wrangler dev / Pages Functions) was not performed here, only source inspection and typechecking; a smoke test of `streamText` under `wrangler dev` is the next step.
- Whether SvelteKit's Cloudflare adapter keeps the `ReadableStream` unbuffered end-to-end (it should, but confirm chunk arrival in the browser).
- Tool-calling ergonomics (`Tool.make`/`Toolkit.make`, `tool-approval-request` parts) were not exercised; only the type surface was read.
