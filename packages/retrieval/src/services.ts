import { Context, type Effect, Layer, type Stream } from 'effect';
import type { Tier, Usage } from '@graphrag/schema';
import type { EmbedError, LanguageModelError } from './errors.ts';
import type { GraphIndex } from './graph.ts';

/** Text → vector. Same model and pooling at build and query time. ADR 0004. */
export interface EmbedderShape {
  readonly model: string;
  readonly dimensions: number;
  readonly embed: (
    texts: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<Float32Array>, EmbedError>;
}
export class Embedder extends Context.Service<Embedder, EmbedderShape>()(
  '@graphrag/retrieval/Embedder',
) {}

export interface LmMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}
export interface LmInput {
  readonly system: string;
  readonly messages: ReadonlyArray<LmMessage>;
  readonly maxTokens: number;
}
export type LmPart =
  | { readonly type: 'text'; readonly delta: string }
  | { readonly type: 'finish'; readonly usage: Usage };

/** One streamed completion. The provider behind it is a layer choice. ADR 0004. */
export interface LanguageModelShape {
  readonly model: string;
  readonly tier: Tier;
  readonly stream: (input: LmInput) => Stream.Stream<LmPart, LanguageModelError>;
}
export class LanguageModel extends Context.Service<LanguageModel, LanguageModelShape>()(
  '@graphrag/retrieval/LanguageModel',
) {}

/** The committed artifact plus its vectors, indexed for lookup. */
export class GraphArtifact extends Context.Service<GraphArtifact, GraphIndex>()(
  '@graphrag/retrieval/GraphArtifact',
) {
  static readonly layer = (index: GraphIndex) => Layer.succeed(GraphArtifact, index);
}
