import { Effect } from 'effect';
import type { GraphId, NodeId } from '@graphrag/schema';
import { isEdgeId, isNodeId, parseEdgeId } from '@graphrag/schema';
import type { Classification } from './classify.ts';
import { requirementLines } from './classify.ts';
import type { EmbedError } from './errors.ts';
import type { GraphIndex } from './graph.ts';
import { Embedder } from './services.ts';
import { topK } from './vector.ts';

export interface Seeds {
  /** node index → similarity-derived weight in (0, 1]. */
  readonly nodes: Map<number, number>;
  /** edge indices that seeded directly (hybrid mode). */
  readonly edges: Set<number>;
  readonly fallback: boolean;
}

export const SEED_THRESHOLD = 0.2;
const K_NODES = 6;
const K_EDGES = 6;
const K_PER_LINE = 3;
const PREVIOUS_WEIGHT = 0.5;

const bump = (m: Map<number, number>, i: number, w: number) => {
  const prev = m.get(i) ?? 0;
  if (w > prev) m.set(i, w);
};

/** ADR 0004 stage 2. */
export const seed = (
  prompt: string,
  cls: Classification,
  previousUsedIds: ReadonlyArray<GraphId>,
  graph: GraphIndex,
): Effect.Effect<Seeds, EmbedError, Embedder> =>
  Effect.gen(function* () {
    const nodes = new Map<number, number>();
    const edges = new Set<number>();
    const visible = (i: number) => !(graph.nodes[i]?.hidden ?? true);
    const { dimensions: d } = graph;

    if (cls.mode === 'entity') {
      for (const i of cls.matchedNodes) bump(nodes, i, 1);
      if (cls.matchedType !== undefined) {
        graph.nodes.forEach((n, i) => {
          if (n.type === cls.matchedType && visible(i)) bump(nodes, i, 0.9);
        });
      }
    } else if (cls.mode === 'match') {
      const embedder = yield* Embedder;
      const lines = requirementLines(prompt);
      const texts = lines.length > 0 ? lines : [prompt.slice(0, 2000)];
      const vectors = yield* embedder.embed(texts);
      const allowed = new Set(['skill', 'experience', 'education']);
      for (const q of vectors) {
        for (const hit of topK(
          graph.nodeVectors,
          graph.nodes.length,
          d,
          q,
          K_PER_LINE,
          (i) => visible(i) && allowed.has(graph.nodes[i]?.type ?? ''),
        )) {
          if (hit.score >= SEED_THRESHOLD) bump(nodes, hit.index, hit.score);
        }
      }
    } else {
      const embedder = yield* Embedder;
      const [q] = yield* embedder.embed([prompt]);
      if (q) {
        for (const hit of topK(graph.nodeVectors, graph.nodes.length, d, q, K_NODES, visible)) {
          if (hit.score >= SEED_THRESHOLD) bump(nodes, hit.index, hit.score);
        }
        for (const hit of topK(graph.edgeVectors, graph.edges.length, d, q, K_EDGES)) {
          if (hit.score < SEED_THRESHOLD) continue;
          const e = graph.edges[hit.index];
          if (!e) continue;
          const s = graph.nodeIndex.get(e.source);
          const t = graph.nodeIndex.get(e.target);
          if (s === undefined || t === undefined || !visible(s) || !visible(t)) continue;
          edges.add(hit.index);
          bump(nodes, s, hit.score * 0.9);
          bump(nodes, t, hit.score * 0.9);
        }
      }
    }

    for (const id of previousUsedIds) {
      if (isNodeId(id)) {
        const i = graph.nodeIndex.get(id as NodeId);
        if (i !== undefined && visible(i)) bump(nodes, i, PREVIOUS_WEIGHT);
      } else if (isEdgeId(id)) {
        const p = parseEdgeId(id);
        if (!p) continue;
        for (const nid of [p.source, p.target]) {
          const i = graph.nodeIndex.get(nid);
          if (i !== undefined && visible(i)) bump(nodes, i, PREVIOUS_WEIGHT);
        }
      }
    }

    let fallback = false;
    if (nodes.size === 0) {
      fallback = true;
      bump(nodes, graph.person, 1);
      const byDegree = graph.nodes
        .map((n, i) => ({ i, deg: n.degree, hidden: n.hidden, type: n.type }))
        .filter((x) => !x.hidden && x.type !== 'person')
        .sort((a, b) => b.deg - a.deg)
        .slice(0, 5);
      for (const x of byDegree) bump(nodes, x.i, 0.6);
    }
    return { nodes, edges, fallback };
  });
