import type {
  ArtifactEdge,
  ArtifactNode,
  EdgeType,
  GraphArtifact,
  NodeId,
  NodeType,
} from '@graphrag/schema';
import { edgeId } from '@graphrag/schema';
import { embedLocal, LOCAL_HASHING_MODEL } from '../src/adapters/local-hashing-embedder.ts';
import { makeGraphIndex, type GraphIndex } from '../src/graph.ts';

interface N {
  id: NodeId;
  title: string;
  body?: string;
  summary?: string;
  aliases?: Array<string>;
  hidden?: boolean;
  fields?: Record<string, string>;
}

const node = (n: N): ArtifactNode => ({
  id: n.id,
  type: n.id.slice(0, n.id.indexOf('/')) as NodeType,
  title: n.title,
  ...(n.summary !== undefined ? { summary: n.summary } : {}),
  hidden: n.hidden ?? false,
  body: n.body ?? '',
  ...(n.aliases ? { aliases: n.aliases } : {}),
  fields: n.fields ?? {},
  degree: 0,
  position: [0, 0, 0],
});

const edge = (
  source: NodeId,
  type: EdgeType,
  target: NodeId,
  note?: string,
  titles?: Map<NodeId, string>,
): ArtifactEdge => ({
  id: edgeId(source, type, target),
  source,
  target,
  type,
  ...(note !== undefined ? { note } : {}),
  text: note ?? `${titles?.get(source) ?? source} ${type} ${titles?.get(target) ?? target}`,
});

/** A small, realistic Knowledge Graph for tests. */
export const fixtureArtifact = (): GraphArtifact => {
  const nodes: Array<ArtifactNode> = [
    node({
      id: 'person/pavel',
      title: 'Pavel',
      summary: 'Software engineer.',
      body: 'Pavel builds web platforms.',
    }),
    node({
      id: 'skill/typescript',
      title: 'TypeScript',
      body: 'Typed JavaScript for large codebases.',
      fields: { category: 'language' },
    }),
    node({
      id: 'skill/effect',
      title: 'Effect',
      body: 'Effect is a TypeScript library for typed errors, dependency injection and streams.',
      fields: { category: 'framework' },
    }),
    node({
      id: 'skill/kubernetes',
      title: 'Kubernetes',
      aliases: ['k8s'],
      body: 'Container orchestration platform for production workloads.',
      fields: { category: 'platform' },
    }),
    node({
      id: 'skill/kafka',
      title: 'Kafka',
      body: 'Event streaming platform.',
      fields: { category: 'platform' },
    }),
    node({
      id: 'skill/frontend',
      title: 'Frontend',
      body: 'Browser applications.',
      fields: { category: 'practice' },
    }),
    node({
      id: 'skill/svelte',
      title: 'Svelte',
      body: 'Compiler-based UI framework.',
      fields: { category: 'framework' },
    }),
    node({
      id: 'project/ingestion',
      title: 'Streaming Ingestion',
      body: 'Ingests forty thousand events per second with Effect streams and Kafka.',
      summary: 'Event ingestion platform.',
    }),
    node({
      id: 'experience/staff-engineer',
      title: 'Staff Engineer',
      body: 'Led the platform team.',
      fields: { role: 'Staff Engineer' },
    }),
    node({ id: 'organization/acme', title: 'Acme Bank', body: 'A bank.' }),
    node({
      id: 'education/msc',
      title: 'MSc Computer Science',
      body: 'Distributed systems and data modelling.',
      fields: { degree: 'MSc' },
    }),
    node({ id: 'organization/univ', title: 'University of Prague', body: 'A university.' }),
    node({ id: 'domain/fintech', title: 'Fintech', body: 'Financial technology.' }),
    node({ id: 'skill/secret', title: 'Secret Skill', hidden: true, body: 'hidden' }),
  ];
  const titles = new Map(nodes.map((n) => [n.id, n.title]));
  const edges: Array<ArtifactEdge> = [
    edge(
      'project/ingestion',
      'uses',
      'skill/effect',
      'Effect Streams and Schedule-based retries process 40k events per second',
      titles,
    ),
    edge('project/ingestion', 'uses', 'skill/kafka', undefined, titles),
    edge('project/ingestion', 'uses', 'skill/typescript', undefined, titles),
    edge('project/ingestion', 'in-domain', 'domain/fintech', undefined, titles),
    edge('experience/staff-engineer', 'at', 'organization/acme', undefined, titles),
    edge('experience/staff-engineer', 'led', 'project/ingestion', undefined, titles),
    edge(
      'experience/staff-engineer',
      'uses',
      'skill/kubernetes',
      'ran the platform on Kubernetes',
      titles,
    ),
    edge('experience/staff-engineer', 'uses', 'skill/effect', undefined, titles),
    edge('experience/staff-engineer', 'in-domain', 'domain/fintech', undefined, titles),
    edge('education/msc', 'at', 'organization/univ', undefined, titles),
    edge('education/msc', 'taught', 'skill/typescript', undefined, titles),
    edge('skill/svelte', 'part-of', 'skill/frontend', undefined, titles),
    edge('skill/effect', 'related-to', 'skill/typescript', undefined, titles),
    edge('experience/staff-engineer', 'uses', 'skill/secret', undefined, titles),
  ];
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  return {
    meta: {
      version: 1,
      generatedAt: '2026-09-17T00:00:00Z',
      embedding: { model: LOCAL_HASHING_MODEL, dimensions: 768 },
      contentHash: 'fixture',
    },
    nodes: nodes.map((n) => ({ ...n, degree: degree.get(n.id) ?? 0 })),
    edges,
  };
};

export const nodeText = (n: ArtifactNode) =>
  [n.title, n.summary ?? '', n.body, ...(n.aliases ?? [])].join('\n');

export const fixtureIndex = (): GraphIndex => {
  const artifact = fixtureArtifact();
  const dim = 768;
  const nv = new Float32Array(artifact.nodes.length * dim);
  artifact.nodes.forEach((n, i) => nv.set(embedLocal(nodeText(n)), i * dim));
  const ev = new Float32Array(artifact.edges.length * dim);
  artifact.edges.forEach((e, i) => ev.set(embedLocal(e.text), i * dim));
  return makeGraphIndex(artifact, nv, ev);
};
