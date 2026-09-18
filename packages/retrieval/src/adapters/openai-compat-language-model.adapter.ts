// Adapter for any OpenAI-compatible `/chat/completions` endpoint with SSE streaming: Workers AI's
// `/ai/v1` today (ADR 0006), Groq or OpenRouter later. Wraps fetch and the SSE wire; errors are
// converted here only (ADR 0005).
import { Duration, Effect, Layer, Stream } from 'effect';
import type { Tier } from '@graphrag/schema';
import { LanguageModelError } from '../errors.ts';
import {
  LM_IDLE_TIMEOUT_SECONDS,
  LM_OPEN_TIMEOUT_SECONDS,
  retryUpstream,
  timeoutUpstream,
} from '../resilience.ts';
import { LanguageModel, type LanguageModelShape, type LmInput, type LmPart } from '../services.ts';

export interface OpenAiCompatOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly tier?: Tier;
  readonly fetch?: typeof globalThis.fetch;
  /** Extra body fields, e.g. `{ reasoning: { enabled: false } }` for Qwen. */
  readonly extra?: Record<string, unknown>;
}

export const workersAiBaseUrl = (accountId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`;

interface ChunkJson {
  choices?: ReadonlyArray<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

/** Parses `data:` lines into LmParts. Exported for tests. */
export const sseToParts = <E, R>(
  lines: Stream.Stream<string, E, R>,
): Stream.Stream<LmPart, E, R> => {
  let usage = { tokensIn: 0, tokensOut: 0 };
  let done = false;
  const lineToParts = (line: string): Array<LmPart> => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return [];
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') {
      if (done) return [];
      done = true;
      return [{ type: 'finish', usage }];
    }
    let json: ChunkJson;
    try {
      json = JSON.parse(payload) as ChunkJson;
    } catch {
      return [];
    }
    if (json.usage) {
      usage = {
        tokensIn: json.usage.prompt_tokens ?? usage.tokensIn,
        tokensOut: json.usage.completion_tokens ?? usage.tokensOut,
      };
    }
    const delta = json.choices?.[0]?.delta?.content;
    return delta ? [{ type: 'text', delta }] : [];
  };
  return lines.pipe(
    Stream.flatMap((line): Stream.Stream<LmPart> => Stream.fromArray(lineToParts(line))),
    Stream.concat(
      Stream.suspend(() =>
        done ? Stream.empty : Stream.succeed<LmPart>({ type: 'finish', usage }),
      ),
    ),
  );
};

/** Opening the stream is the retryable half: nothing has reached the visitor yet. */
const openStream = <A, R>(open: Effect.Effect<A, LanguageModelError, R>) =>
  open.pipe(
    timeoutUpstream(
      LM_OPEN_TIMEOUT_SECONDS,
      () =>
        new LanguageModelError({
          message: `the model did not answer within ${LM_OPEN_TIMEOUT_SECONDS}s`,
          retryable: true,
        }),
    ),
    retryUpstream,
  );

export const openAiCompatLanguageModel = (options: OpenAiCompatOptions): LanguageModelShape => {
  const doFetch = options.fetch ?? globalThis.fetch;
  return {
    model: options.model,
    tier: options.tier ?? 'primary',
    stream: (input: LmInput) =>
      Stream.unwrap(
        openStream(
          Effect.gen(function* () {
            const body = {
              model: options.model,
              stream: true,
              stream_options: { include_usage: true },
              max_tokens: input.maxTokens,
              messages: [{ role: 'system', content: input.system }, ...input.messages],
              ...options.extra,
            };
            const res = yield* Effect.tryPromise({
              try: (signal) =>
                doFetch(`${options.baseUrl}/chat/completions`, {
                  method: 'POST',
                  headers: {
                    authorization: `Bearer ${options.apiKey}`,
                    'content-type': 'application/json',
                  },
                  body: JSON.stringify(body),
                  signal,
                }),
              catch: (cause) =>
                new LanguageModelError({
                  message: `LLM request failed: ${String(cause)}`,
                  retryable: true,
                  cause,
                }),
            });
            if (!res.ok || !res.body) {
              const text = yield* Effect.tryPromise({
                try: () => res.text(),
                catch: () =>
                  new LanguageModelError({ message: 'unreadable error body', retryable: true }),
              });
              return yield* new LanguageModelError({
                message: `LLM returned ${res.status}: ${text.slice(0, 300)}`,
                retryable: res.status === 429 || res.status >= 500,
              });
            }
            return Stream.fromReadableStream({
              evaluate: () => res.body as ReadableStream<Uint8Array>,
              onError: (cause) =>
                new LanguageModelError({
                  message: `LLM stream failed: ${String(cause)}`,
                  retryable: true,
                  cause,
                }),
            }).pipe(Stream.decodeText(), Stream.splitLines, sseToParts);
          }),
        ),
      ).pipe(
        // Once the Answer is streaming a retry would replay tokens the visitor has already read,
        // so silence past this point ends the Turn with an error instead.
        Stream.timeoutOrElse({
          duration: Duration.seconds(LM_IDLE_TIMEOUT_SECONDS),
          orElse: () =>
            Stream.fail(
              new LanguageModelError({
                message: `the model went quiet for ${LM_IDLE_TIMEOUT_SECONDS}s`,
                retryable: true,
              }),
            ),
        }),
      ),
  };
};

export const OpenAiCompatLanguageModelLayer = (options: OpenAiCompatOptions) =>
  Layer.succeed(LanguageModel, openAiCompatLanguageModel(options));
