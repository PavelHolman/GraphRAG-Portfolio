import type { EdgeType, TurnMode } from '@graphrag/schema';
import type { GraphIndex } from './graph.ts';
import type { Seeds } from './seed.ts';

/** Constants in Retrieval, never authored. ADR 0004 stage 3. */
export const EDGE_WEIGHT: Record<EdgeType, number> = {
  uses: 1.0,
  led: 1.0,
  delivered: 1.0,
  at: 0.7,
  taught: 0.7,
  'in-domain': 0.7,
  'part-of': 0.5,
  'related-to': 0.3,
};

export const BUDGET = { nodes: 40, edges: 80, contextChars: 24_000 } as const;

export interface Candidate {
  /** node index → accumulated score (seeds keep their seed weight). */
  readonly nodes: Map<number, number>;
  readonly edges: Set<number>;
  readonly seeds: ReadonlyArray<number>;
}

/** Weighted expansion, one hop (two for `match`), then the Node and Edge budget. Stages 3 and 4. */
export const expand = (seeds: Seeds, mode: TurnMode, graph: GraphIndex): Candidate => {
  const hops = mode === 'match' ? 2 : 1;
  const score = new Map<number, number>(seeds.nodes);
  const hopOf = new Map<number, number>();
  for (const i of seeds.nodes.keys()) hopOf.set(i, 0);
  let frontier = [...seeds.nodes.keys()];
  for (let h = 1; h <= hops; h++) {
    const next: Array<number> = [];
    const hopScale = h === 1 ? 1 : 0.5;
    for (const from of frontier) {
      const base = score.get(from) ?? 0;
      for (const { edge, node } of graph.adjacency[from] ?? []) {
        const n = graph.nodes[node];
        const e = graph.edges[edge];
        if (!n || !e || n.hidden) continue;
        const gain = base * EDGE_WEIGHT[e.type] * hopScale;
        const wasKnown = score.has(node);
        score.set(node, (score.get(node) ?? 0) + (hopOf.get(node) === 0 ? 0 : gain));
        if (!wasKnown) {
          hopOf.set(node, h);
          next.push(node);
        }
      }
    }
    frontier = next;
  }

  const seedList = [...seeds.nodes.keys()].sort(
    (a, b) => (seeds.nodes.get(b) ?? 0) - (seeds.nodes.get(a) ?? 0),
  );
  const ranked = [...score.entries()]
    .filter(([i]) => !seeds.nodes.has(i))
    .sort((a, b) => b[1] - a[1])
    .map(([i]) => i);
  const keep = new Set<number>(seedList.slice(0, BUDGET.nodes));
  for (const i of ranked) {
    if (keep.size >= BUDGET.nodes - 1) break;
    keep.add(i);
  }
  keep.add(graph.person);

  const edges = new Set<number>();
  const edgeScore = (ei: number): number => {
    const e = graph.edges[ei];
    if (!e) return 0;
    const s = score.get(graph.nodeIndex.get(e.source) ?? -1) ?? 0;
    const t = score.get(graph.nodeIndex.get(e.target) ?? -1) ?? 0;
    return (s + t) * EDGE_WEIGHT[e.type] + (seeds.edges.has(ei) ? 10 : 0);
  };
  const candidateEdges: Array<number> = [];
  graph.edges.forEach((e, ei) => {
    const s = graph.nodeIndex.get(e.source);
    const t = graph.nodeIndex.get(e.target);
    if (s === undefined || t === undefined) return;
    if (!keep.has(s) || !keep.has(t)) return;
    if (!(seeds.nodes.has(s) || seeds.nodes.has(t))) return;
    candidateEdges.push(ei);
  });
  candidateEdges.sort((a, b) => edgeScore(b) - edgeScore(a));
  for (const ei of candidateEdges.slice(0, BUDGET.edges)) edges.add(ei);

  const nodes = new Map<number, number>();
  for (const i of keep) nodes.set(i, score.get(i) ?? 0);
  return { nodes, edges, seeds: seedList.filter((i) => keep.has(i)) };
};
