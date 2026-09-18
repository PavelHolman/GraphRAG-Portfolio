import { Effect, Layer } from 'effect';
import { EmbedError } from '../errors.ts';
import { Embedder, type EmbedderShape } from '../services.ts';

/** SHA-256 hex of the exact text embedded; the key of the committed embedding cache. */
export const sha256 = (text: string): Effect.Effect<string, EmbedError> =>
  Effect.tryPromise({
    try: async () => {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
    },
    catch: (cause) =>
      new EmbedError({ message: `SHA-256 failed: ${String(cause)}`, retryable: false, cause }),
  });

/**
 * An Embedder that only answers from precomputed vectors keyed by text hash. CI, hint precompute
 * and the retrieval eval tier use it so nothing outside `content:index` ever needs a credential.
 */
export const cachedTextEmbedder = (
  model: string,
  dimensions: number,
  vectors: ReadonlyMap<string, Float32Array>,
): EmbedderShape => ({
  model,
  dimensions,
  embed: (texts) =>
    Effect.forEach(texts, (t) =>
      sha256(t).pipe(
        Effect.flatMap((h) => {
          const v = vectors.get(h);
          return v
            ? Effect.succeed(v)
            : Effect.fail(
                new EmbedError({
                  message: `no cached vector for ${JSON.stringify(t.slice(0, 60))}; run \`bun content:index\` locally and commit .cache/`,
                  retryable: false,
                }),
              );
        }),
      ),
    ),
});

export const CachedTextEmbedderLayer = (
  model: string,
  dimensions: number,
  vectors: ReadonlyMap<string, Float32Array>,
) => Layer.succeed(Embedder, cachedTextEmbedder(model, dimensions, vectors));
