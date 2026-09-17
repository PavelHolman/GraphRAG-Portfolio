/** Cosine over L2-normalised rows is a dot product. */
export const dotRow = (
  matrix: Float32Array,
  row: number,
  dims: number,
  q: Float32Array,
): number => {
  let s = 0;
  const off = row * dims;
  for (let i = 0; i < dims; i++) s += (matrix[off + i] ?? 0) * (q[i] ?? 0);
  return s;
};

export const normalize = (v: Float32Array): Float32Array => {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += (v[i] ?? 0) ** 2;
  n = Math.sqrt(n) || 1;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = (v[i] ?? 0) / n;
  return out;
};

export interface Scored {
  readonly index: number;
  readonly score: number;
}

/** Top-k rows by dot product with `q`, optionally restricted by a predicate on the row index. */
export const topK = (
  matrix: Float32Array,
  rows: number,
  dims: number,
  q: Float32Array,
  k: number,
  allow: (row: number) => boolean = () => true,
): Array<Scored> => {
  const out: Array<Scored> = [];
  for (let r = 0; r < rows; r++) {
    if (!allow(r)) continue;
    out.push({ index: r, score: dotRow(matrix, r, dims, q) });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, k);
};
