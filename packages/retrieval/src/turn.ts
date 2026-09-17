import { Effect, Stream } from 'effect';
import type { EdgeId, GraphId, NodeId, TurnEvent, TurnRequest } from '@graphrag/schema';
import { isEdgeId, isNodeId } from '@graphrag/schema';
import { classify } from './classify.ts';
import { expand } from './expand.ts';
import type { GraphIndex } from './graph.ts';
import { AnswerParser } from './parse.ts';
import { buildPrompt } from './prompt.ts';
import { seed } from './seed.ts';
import { Embedder, GraphArtifact, LanguageModel } from './services.ts';

export type TurnServices = Embedder | LanguageModel | GraphArtifact;

const errorEvent = (
  tag: 'upstream' | 'internal',
  message: string,
  retryable: boolean,
): TurnEvent => ({
  type: 'error',
  tag,
  message,
  retryable,
});

export interface RetrievalResult {
  readonly turnId: string;
  readonly mode: TurnEvent extends { mode: infer M } ? M : never;
  readonly candidate: ReturnType<typeof expand>;
  readonly classification: ReturnType<typeof classify>;
  readonly graph: GraphIndex;
}

/** Stages 1–4 without the LLM: what `content:ask` and the retrieval eval tier use. */
export const retrieve = (request: TurnRequest) =>
  Effect.gen(function* () {
    const graph = yield* GraphArtifact;
    const classification = yield* Effect.sync(() => classify(request.prompt, graph)).pipe(
      Effect.withSpan('classify'),
    );
    const seeds = yield* seed(
      request.prompt,
      classification,
      request.previousUsedIds ?? [],
      graph,
    ).pipe(Effect.withSpan('seed'));
    const candidate = yield* Effect.sync(() => expand(seeds, classification.mode, graph)).pipe(
      Effect.withSpan('expand'),
    );
    return { classification, seeds, candidate, graph };
  });

/** The one deep operation. ADR 0002, ADR 0004. Errors become a terminal `error` event. */
export const turn = (request: TurnRequest): Stream.Stream<TurnEvent, never, TurnServices> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const lm = yield* LanguageModel;
      const turnId = yield* Effect.sync(() => crypto.randomUUID());
      const { classification, candidate, graph } = yield* retrieve(request);
      const candidateNodeIds = new Set<string>();
      const candidateEdgeIds = new Set<string>();
      const nodeIds: Array<NodeId> = [];
      const edgeIds: Array<EdgeId> = [];
      for (const i of candidate.nodes.keys()) {
        const n = graph.nodes[i];
        if (n && !n.hidden) {
          nodeIds.push(n.id);
          candidateNodeIds.add(n.id);
        }
      }
      for (const ei of candidate.edges) {
        const e = graph.edges[ei];
        if (e) {
          edgeIds.push(e.id);
          candidateEdgeIds.add(e.id);
        }
      }
      const seedIds = candidate.seeds
        .map((i) => graph.nodes[i]?.id)
        .filter((id): id is NodeId => id !== undefined);

      const head: Array<TurnEvent> = [
        { type: 'turn-started', turnId, mode: classification.mode, tier: lm.tier },
        { type: 'subgraph', nodeIds, edgeIds, seedIds },
      ];

      const input = buildPrompt(
        request.prompt,
        classification.mode,
        candidate,
        request.history ?? [],
        graph,
      );
      const parser = new AnswerParser();
      const ordinals = new Map<GraphId, number>();
      const usedNodes = new Set<NodeId>();
      const usedEdges = new Set<EdgeId>();
      let usage = { tokensIn: 0, tokensOut: 0 };

      const toEvents = (
        parts: ReadonlyArray<ReturnType<AnswerParser['push']>[number]>,
      ): Array<TurnEvent> => {
        const out: Array<TurnEvent> = [];
        for (const p of parts) {
          if (p.type === 'text') out.push({ type: 'text', delta: p.delta });
          else if (p.type === 'followups') out.push({ type: 'followups', prompts: p.prompts });
          else {
            const id = p.id;
            const valid =
              (isNodeId(id) && candidateNodeIds.has(id)) ||
              (isEdgeId(id) && candidateEdgeIds.has(id));
            if (!valid) {
              const title = isNodeId(id)
                ? graph.nodes[graph.nodeIndex.get(id as NodeId) ?? -1]?.title
                : undefined;
              if (title) out.push({ type: 'text', delta: title });
              continue;
            }
            let ordinal = ordinals.get(id as GraphId);
            if (ordinal === undefined) {
              ordinal = ordinals.size;
              ordinals.set(id as GraphId, ordinal);
              if (isNodeId(id)) usedNodes.add(id as NodeId);
              else usedEdges.add(id as EdgeId);
            }
            out.push({ type: 'citation', id: id as GraphId, ordinal });
          }
        }
        return out;
      };

      const generated = lm.stream(input).pipe(
        Stream.flatMap((part): Stream.Stream<TurnEvent> => {
          if (part.type === 'finish') {
            usage = part.usage;
            return Stream.empty;
          }
          return Stream.fromArray(toEvents(parser.push(part.delta)));
        }),
        Stream.concat(
          Stream.suspend(() => {
            const tail = toEvents(parser.finish());
            // Edges cited imply their endpoints are used; keep the Scene honest.
            for (const eid of usedEdges) {
              const e = graph.edges[graph.edgeIndex.get(eid) ?? -1];
              if (e) {
                usedNodes.add(e.source);
                usedNodes.add(e.target);
              }
            }
            const finished: TurnEvent = {
              type: 'turn-finished',
              usedNodeIds: [...usedNodes],
              usedEdgeIds: [...usedEdges],
              usage,
            };
            return Stream.fromArray([...tail, finished]);
          }),
        ),
        Stream.catchTag('LanguageModelError', (e) =>
          Stream.succeed(errorEvent('upstream', e.message, e.retryable)),
        ),
      );

      return Stream.fromArray(head).pipe(Stream.concat(generated));
    }).pipe(
      Effect.withSpan('turn'),
      Effect.catchTag('EmbedError', (e) =>
        Effect.succeed(Stream.succeed(errorEvent('upstream', e.message, e.retryable))),
      ),
    ),
  );
