import type { NodeType, Vec3 } from '@graphrag/schema';
import { NODE_TYPES } from '@graphrag/schema';

export interface LayoutInput {
  readonly types: ReadonlyArray<NodeType>;
  readonly edges: ReadonlyArray<readonly [number, number]>;
}

const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
};

const ORDER: ReadonlyArray<NodeType> = [
  'experience',
  'project',
  'skill',
  'education',
  'organization',
  'domain',
];

/** Seeded force layout with per-type cluster gravity, Person at the origin. `docs/spec/scene.md`. */
export const forceLayout = (input: LayoutInput, iterations = 350, seed = 7): Array<Vec3> => {
  const r = rng(seed);
  const n = input.types.length;
  const pos = new Float64Array(n * 3);
  const vel = new Float64Array(n * 3);
  const centre = new Map<NodeType, [number, number, number]>();
  for (const t of NODE_TYPES) centre.set(t, [0, 0, 0]);
  ORDER.forEach((t, i) => {
    const a = (i / ORDER.length) * Math.PI * 2;
    centre.set(t, [Math.cos(a) * 9, i % 2 ? 2 : -2, Math.sin(a) * 9]);
  });
  for (let i = 0; i < n; i++) {
    const c = centre.get(input.types[i] ?? 'skill') ?? [0, 0, 0];
    pos[i * 3] = c[0] + (r() - 0.5) * 6;
    pos[i * 3 + 1] = c[1] + (r() - 0.5) * 6;
    pos[i * 3 + 2] = c[2] + (r() - 0.5) * 6;
  }
  for (let it = 0; it < iterations; it++) {
    const t = 1 - it / iterations;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = (pos[i * 3] ?? 0) - (pos[j * 3] ?? 0);
        let dy = (pos[i * 3 + 1] ?? 0) - (pos[j * 3 + 1] ?? 0);
        let dz = (pos[i * 3 + 2] ?? 0) - (pos[j * 3 + 2] ?? 0);
        const d2 = dx * dx + dy * dy + dz * dz + 0.01;
        if (d2 > 64) continue;
        const f = (1.2 / d2) * t;
        dx *= f;
        dy *= f;
        dz *= f;
        vel[i * 3] = (vel[i * 3] ?? 0) + dx;
        vel[i * 3 + 1] = (vel[i * 3 + 1] ?? 0) + dy;
        vel[i * 3 + 2] = (vel[i * 3 + 2] ?? 0) + dz;
        vel[j * 3] = (vel[j * 3] ?? 0) - dx;
        vel[j * 3 + 1] = (vel[j * 3 + 1] ?? 0) - dy;
        vel[j * 3 + 2] = (vel[j * 3 + 2] ?? 0) - dz;
      }
    }
    for (const [s, d] of input.edges) {
      const dx = (pos[d * 3] ?? 0) - (pos[s * 3] ?? 0);
      const dy = (pos[d * 3 + 1] ?? 0) - (pos[s * 3 + 1] ?? 0);
      const dz = (pos[d * 3 + 2] ?? 0) - (pos[s * 3 + 2] ?? 0);
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
      const f = (len - 2.2) * 0.02 * t;
      vel[s * 3] = (vel[s * 3] ?? 0) + (dx / len) * f;
      vel[s * 3 + 1] = (vel[s * 3 + 1] ?? 0) + (dy / len) * f;
      vel[s * 3 + 2] = (vel[s * 3 + 2] ?? 0) + (dz / len) * f;
      vel[d * 3] = (vel[d * 3] ?? 0) - (dx / len) * f;
      vel[d * 3 + 1] = (vel[d * 3 + 1] ?? 0) - (dy / len) * f;
      vel[d * 3 + 2] = (vel[d * 3 + 2] ?? 0) - (dz / len) * f;
    }
    for (let i = 0; i < n; i++) {
      const type = input.types[i] ?? 'skill';
      const c = centre.get(type) ?? [0, 0, 0];
      const gk = type === 'person' ? 0.3 : 0.012;
      vel[i * 3] = (vel[i * 3] ?? 0) + (c[0] - (pos[i * 3] ?? 0)) * gk;
      vel[i * 3 + 1] = (vel[i * 3 + 1] ?? 0) + (c[1] - (pos[i * 3 + 1] ?? 0)) * gk;
      vel[i * 3 + 2] = (vel[i * 3 + 2] ?? 0) + (c[2] - (pos[i * 3 + 2] ?? 0)) * gk;
      for (let k = 0; k < 3; k++) {
        vel[i * 3 + k] = (vel[i * 3 + k] ?? 0) * 0.6;
        pos[i * 3 + k] = (pos[i * 3 + k] ?? 0) + (vel[i * 3 + k] ?? 0);
      }
    }
  }
  const round = (x: number) => Math.round(x * 1000) / 1000;
  const out: Array<Vec3> = [];
  for (let i = 0; i < n; i++)
    out.push([round(pos[i * 3] ?? 0), round(pos[i * 3 + 1] ?? 0), round(pos[i * 3 + 2] ?? 0)]);
  return out;
};
