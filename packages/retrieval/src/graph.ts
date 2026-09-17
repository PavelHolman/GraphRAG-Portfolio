import type { ArtifactEdge, ArtifactNode, EdgeId, GraphArtifact, NodeId } from '@graphrag/schema';

export interface Adjacent {
  readonly edge: number;
  readonly node: number;
}

/** Runtime view of the artifact: index positions, adjacency, vectors. */
export interface GraphIndex {
  readonly artifact: GraphArtifact;
  readonly nodes: ReadonlyArray<ArtifactNode>;
  readonly edges: ReadonlyArray<ArtifactEdge>;
  readonly nodeIndex: ReadonlyMap<NodeId, number>;
  readonly edgeIndex: ReadonlyMap<EdgeId, number>;
  /** Undirected adjacency: for each node, the incident edges and the node at the other end. */
  readonly adjacency: ReadonlyArray<ReadonlyArray<Adjacent>>;
  readonly person: number;
  readonly dimensions: number;
  /** Row-major `nodes.length × dimensions`, L2-normalised. */
  readonly nodeVectors: Float32Array;
  readonly edgeVectors: Float32Array;
}

export const makeGraphIndex = (
  artifact: GraphArtifact,
  nodeVectors: Float32Array,
  edgeVectors: Float32Array,
): GraphIndex => {
  const nodeIndex = new Map<NodeId, number>();
  artifact.nodes.forEach((n, i) => nodeIndex.set(n.id, i));
  const edgeIndex = new Map<EdgeId, number>();
  const adjacency: Array<Array<Adjacent>> = artifact.nodes.map(() => []);
  artifact.edges.forEach((e, ei) => {
    edgeIndex.set(e.id, ei);
    const s = nodeIndex.get(e.source);
    const t = nodeIndex.get(e.target);
    if (s === undefined || t === undefined) return;
    adjacency[s]?.push({ edge: ei, node: t });
    adjacency[t]?.push({ edge: ei, node: s });
  });
  const person = artifact.nodes.findIndex((n) => n.type === 'person');
  return {
    artifact,
    nodes: artifact.nodes,
    edges: artifact.edges,
    nodeIndex,
    edgeIndex,
    adjacency,
    person: person < 0 ? 0 : person,
    dimensions: artifact.meta.embedding.dimensions,
    nodeVectors,
    edgeVectors,
  };
};
