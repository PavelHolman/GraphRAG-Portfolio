import { Effect, Layer } from 'effect';
import { Embedder, type EmbedderShape } from '../services.ts';
import { normalize } from '../vector.ts';

export const LOCAL_HASHING_MODEL = 'local-hashing-768';
const DIM = 768;

/** FNV-1a 32-bit. */
const hash = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

const tokens = (text: string): Array<string> =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.+#]+/gu, ' ')
    .split(' ')
    .filter((t) => t.length > 1);

/**
 * Deterministic bag-of-words hashing embedder (unigrams and bigrams into 768 signed buckets).
 * It measures lexical overlap, nothing more. For tests, offline dev and as the last-resort fallback;
 * the committed artifact records its model name so a real embedding run is never mistaken for this.
 */
export const embedLocal = (text: string): Float32Array => {
  const v = new Float32Array(DIM);
  const ts = tokens(text);
  const add = (t: string, w: number) => {
    const h = hash(t);
    v[h % DIM] = (v[h % DIM] ?? 0) + (h & 0x10000 ? w : -w);
  };
  for (let i = 0; i < ts.length; i++) {
    add(ts[i] ?? '', 1);
    if (i + 1 < ts.length) add(`${ts[i]} ${ts[i + 1]}`, 0.5);
  }
  return normalize(v);
};

export const localHashingEmbedder: EmbedderShape = {
  model: LOCAL_HASHING_MODEL,
  dimensions: DIM,
  embed: (texts) => Effect.sync(() => texts.map(embedLocal)),
};

export const LocalHashingEmbedderLayer = Layer.succeed(Embedder, localHashingEmbedder);
