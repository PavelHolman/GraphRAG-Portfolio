import type { NodeType } from '@graphrag/schema';

/** What the Scene needs about a Node: ids are strings, everything else is by index. */
export interface SceneNode {
  readonly id: string;
  readonly type: NodeType;
  readonly title: string;
  readonly summary?: string | undefined;
  readonly degree: number;
}

export interface SceneEdge {
  readonly id: string;
  readonly source: number;
  readonly target: number;
}

export interface SceneGraph {
  readonly nodes: ReadonlyArray<SceneNode>;
  readonly edges: ReadonlyArray<SceneEdge>;
  /** Precomputed Layout, xyz per Node. */
  readonly positions: Float32Array;
  readonly person: number;
}

/** Highlight state by Node and Edge index. `docs/spec/scene.md`. */
export interface Subgraph {
  readonly seeds: ReadonlySet<number>;
  readonly nodes: ReadonlySet<number>;
  readonly edges: ReadonlySet<number>;
}

export const emptySubgraph = (): Subgraph => ({
  seeds: new Set(),
  nodes: new Set(),
  edges: new Set(),
});

export const PALETTE = {
  bg: '#161514',
  rest: '#d6d2c9',
  person: '#f1efe9',
  seed: '#ff8a72',
  cited: '#f1efe9',
  faint: '#8f8b83',
  dim: '#4a4743',
  edgeRest: '#242220',
  edgeHi: '#8a5f54',
  edgeDim: '#1a1816',
  dust: '#6b6761',
} as const;
