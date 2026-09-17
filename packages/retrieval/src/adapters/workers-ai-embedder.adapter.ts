// Adapter for Workers AI `@cf/baai/bge-base-en-v1.5` (768-d, mean pooling, no query instruction). ADR 0004.
// Wraps a third-party API that rejects with plain errors; conversion happens here only (ADR 0005).
import { Effect, Layer } from 'effect';
import { EmbedError } from '../errors.ts';
import { Embedder, type EmbedderShape } from '../services.ts';
import { normalize } from '../vector.ts';

export const WORKERS_AI_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';
const DIM = 768;
const BATCH = 50;

/** The subset of the Workers AI binding this adapter uses. */
export interface AiBinding {
  run(
    model: string,
    input: { text: ReadonlyArray<string> },
  ): Promise<{ data?: ReadonlyArray<ReadonlyArray<number>> }>;
}

const toVectors = (data: ReadonlyArray<ReadonlyArray<number>> | undefined, expected: number) =>
  Effect.gen(function* () {
    if (!data || data.length !== expected) {
      return yield* new EmbedError({
        message: `Workers AI returned ${data?.length ?? 0} vectors for ${expected} inputs`,
        retryable: true,
      });
    }
    return data.map((row) => normalize(Float32Array.from(row)));
  });

const batched = (
  texts: ReadonlyArray<string>,
  run: (batch: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<Float32Array>, EmbedError>,
) =>
  Effect.gen(function* () {
    const out: Array<Float32Array> = [];
    for (let i = 0; i < texts.length; i += BATCH) {
      const batch = texts.slice(i, i + BATCH);
      out.push(...(yield* run(batch)));
    }
    return out;
  });

/** Runtime: the `AI` binding on the Worker. */
export const workersAiBindingEmbedder = (ai: AiBinding): EmbedderShape => ({
  model: WORKERS_AI_EMBEDDING_MODEL,
  dimensions: DIM,
  embed: (texts) =>
    batched(texts, (batch) =>
      Effect.tryPromise({
        try: () => ai.run(WORKERS_AI_EMBEDDING_MODEL, { text: batch }),
        catch: (cause) =>
          new EmbedError({
            message: `Workers AI binding failed: ${String(cause)}`,
            retryable: true,
            cause,
          }),
      }).pipe(Effect.flatMap((r) => toVectors(r.data, batch.length))),
    ),
});

export const WorkersAiBindingEmbedderLayer = (ai: AiBinding) =>
  Layer.succeed(Embedder, workersAiBindingEmbedder(ai));

/** Build time (Bun): the REST endpoint with an API token. */
export const workersAiRestEmbedder = (options: {
  readonly accountId: string;
  readonly token: string;
  readonly fetch?: typeof globalThis.fetch;
}): EmbedderShape => {
  const doFetch = options.fetch ?? globalThis.fetch;
  const url = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/ai/run/${WORKERS_AI_EMBEDDING_MODEL}`;
  return {
    model: WORKERS_AI_EMBEDDING_MODEL,
    dimensions: DIM,
    embed: (texts) =>
      batched(texts, (batch) =>
        Effect.tryPromise({
          try: async () => {
            const res = await doFetch(url, {
              method: 'POST',
              headers: {
                authorization: `Bearer ${options.token}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify({ text: batch }),
            });
            const json = (await res.json()) as {
              success?: boolean;
              result?: { data?: ReadonlyArray<ReadonlyArray<number>> };
              errors?: unknown;
            };
            return { status: res.status, json };
          },
          catch: (cause) =>
            new EmbedError({
              message: `Workers AI REST call failed: ${String(cause)}`,
              retryable: true,
              cause,
            }),
        }).pipe(
          Effect.flatMap(({ status, json }) =>
            status >= 200 && status < 300 && json.success !== false
              ? toVectors(json.result?.data, batch.length)
              : Effect.fail(
                  new EmbedError({
                    message: `Workers AI REST returned ${status}: ${JSON.stringify(json.errors ?? json).slice(0, 300)}`,
                    retryable: status === 429 || status >= 500,
                  }),
                ),
          ),
        ),
      ),
  };
};

export const WorkersAiRestEmbedderLayer = (options: Parameters<typeof workersAiRestEmbedder>[0]) =>
  Layer.succeed(Embedder, workersAiRestEmbedder(options));
