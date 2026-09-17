import type { Subgraph } from './types.ts';

/** Approved strength for the answer-time shift. `docs/spec/scene.md`. */
export const PULL = 0.45;

/**
 * Answer-time shift: with centroid c of the Subgraph, seeds move to c + (p − c) × 0.66, cited
 * neighbours × 0.78, everything else × 1.16, then everything translates by −c so the Subgraph sits
 * at the origin. With no Subgraph the base Layout is returned untouched.
 */
export const relayout = (
  base: Float32Array,
  sg: Subgraph | null,
  strength = PULL,
): Float32Array => {
  if (!sg || strength <= 0 || sg.nodes.size === 0) return base;
  const out = new Float32Array(base);
  const n = base.length / 3;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const i of sg.nodes) {
    cx += base[i * 3] ?? 0;
    cy += base[i * 3 + 1] ?? 0;
    cz += base[i * 3 + 2] ?? 0;
  }
  const k = sg.nodes.size;
  cx /= k;
  cy /= k;
  cz /= k;
  for (let i = 0; i < n; i++) {
    const inSg = sg.nodes.has(i);
    const seed = sg.seeds.has(i);
    const f = seed ? 1 - strength * 0.75 : inSg ? 1 - strength * 0.5 : 1 + strength * 0.35;
    out[i * 3] = cx + ((base[i * 3] ?? 0) - cx) * f - cx;
    out[i * 3 + 1] = cy + ((base[i * 3 + 1] ?? 0) - cy) * f - cy;
    out[i * 3 + 2] = cz + ((base[i * 3 + 2] ?? 0) - cz) * f - cz;
  }
  return out;
};
