import type { PageServerLoad } from './$types';
import { artifact, hints } from '$lib/server/artifact.ts';
import { buildPageModel } from '$lib/sections/model.ts';

/** Everything the page needs is derived from the committed artifact at request time. */
export const load: PageServerLoad = ({ url }) => {
  const nodes = artifact.nodes.filter((n) => !n.hidden);
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const edges = artifact.edges
    .map((e) => ({ id: e.id, source: index.get(e.source), target: index.get(e.target) }))
    .filter(
      (e): e is { id: string; source: number; target: number } =>
        e.source !== undefined && e.target !== undefined,
    );
  return {
    scene: {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        summary: n.summary,
        degree: n.degree,
      })),
      edges,
      positions: nodes.flatMap((n) => n.position),
      person: Math.max(
        0,
        nodes.findIndex((n) => n.type === 'person'),
      ),
    },
    hints: hints.map((h) => ({
      id: h.id,
      prompt: h.prompt,
      candidates: h.candidateIds
        .map((id) => index.get(id))
        .filter((i): i is number => i !== undefined),
    })),
    model: buildPageModel(artifact.nodes, artifact.edges),
    embeddingModel: artifact.meta.embedding.model,
    // Link previews need absolute URLs; the origin is whatever host served this request.
    origin: url.origin,
  };
};
