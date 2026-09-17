import { Data, Effect, Layer, Schema } from 'effect';
import type { NodeId } from '@graphrag/schema';
import { Embedder, type EmbedderShape, EmbedError } from '@graphrag/retrieval';
import { sha256 } from '@graphrag/retrieval/adapters';
import type { LoadedNode } from './load.ts';
import type { ResolvedEdge } from './validate.ts';

/** `.cache/embeddings.json`: `{ [id]: { hash, vector } }`, hash = SHA-256 of the exact text embedded. */
export const EmbeddingCache = Schema.Record(
  Schema.String,
  Schema.Struct({ model: Schema.String, hash: Schema.String, vector: Schema.Array(Schema.Number) }),
);
export type EmbeddingCache = typeof EmbeddingCache.Type;

export const nodeText = (n: LoadedNode): string => {
  const fm = n.frontmatter as { title: string; summary?: string; aliases?: ReadonlyArray<string> };
  const parts = [fm.title];
  if (fm.summary) parts.push(fm.summary);
  if (n.body) parts.push(n.body);
  if (fm.aliases?.length) parts.push(`Also known as: ${fm.aliases.join(', ')}`);
  return parts.join('\n');
};

const EDGE_VERB: Record<ResolvedEdge['type'], string> = {
  uses: 'uses',
  at: 'at',
  delivered: 'delivered',
  led: 'led',
  'in-domain': 'in the domain of',
  'part-of': 'is part of',
  'related-to': 'is related to',
  taught: 'taught',
};

export const edgeText = (e: ResolvedEdge, titles: ReadonlyMap<NodeId, string>): string =>
  e.note ??
  `${titles.get(e.source) ?? e.source} ${EDGE_VERB[e.type]} ${titles.get(e.target) ?? e.target}`;

export { sha256 } from '@graphrag/retrieval/adapters';

export class CacheMiss extends Data.TaggedError('CacheMiss')<{
  readonly ids: ReadonlyArray<string>;
}> {}

export interface EmbeddedText {
  readonly id: string;
  readonly text: string;
}

/** Embeds cache misses through the Embedder; returns vectors in input order and the updated cache. */
export const embedWithCache = (
  items: ReadonlyArray<EmbeddedText>,
  cache: EmbeddingCache,
  options: { readonly verify: boolean },
) =>
  Effect.gen(function* () {
    const embedder = yield* Embedder;
    const hashes = yield* Effect.forEach(items, (it) => sha256(it.text));
    const misses: Array<number> = [];
    items.forEach((it, i) => {
      const c = cache[it.id];
      if (!c || c.hash !== hashes[i] || c.model !== embedder.model) misses.push(i);
    });
    if (options.verify && misses.length > 0) {
      return yield* new CacheMiss({ ids: misses.map((i) => items[i]?.id ?? '') });
    }
    const next: Record<string, { model: string; hash: string; vector: ReadonlyArray<number> }> = {};
    for (const it of items) {
      const c = cache[it.id];
      if (c) next[it.id] = c;
    }
    if (misses.length > 0) {
      const vectors = yield* embedder.embed(misses.map((i) => items[i]?.text ?? ''));
      misses.forEach((i, k) => {
        const v = vectors[k];
        const it = items[i];
        if (v && it) next[it.id] = { model: embedder.model, hash: hashes[i] ?? '', vector: [...v] };
      });
    }
    const dims = embedder.dimensions;
    const out = new Float32Array(items.length * dims);
    items.forEach((it, i) => out.set(next[it.id]?.vector ?? [], i * dims));
    // Drop cache entries for ids that no longer exist.
    const pruned: Record<string, { model: string; hash: string; vector: ReadonlyArray<number> }> =
      {};
    for (const it of items) {
      const c = next[it.id];
      if (c) pruned[it.id] = c;
    }
    return {
      vectors: out,
      cache: pruned as EmbeddingCache,
      embedded: misses.length,
      model: embedder.model,
      dimensions: dims,
    };
  });

/** An Embedder that only answers from the cache; CI uses it so no credential is needed. */
export const cacheOnlyEmbedder = (model: string, dimensions: number): EmbedderShape => ({
  model,
  dimensions,
  embed: (texts) =>
    Effect.fail(
      new EmbedError({
        message: `${texts.length} texts are not in the embedding cache`,
        retryable: false,
      }),
    ),
});
export const CacheOnlyEmbedderLayer = (model: string, dimensions: number) =>
  Layer.succeed(Embedder, cacheOnlyEmbedder(model, dimensions));
