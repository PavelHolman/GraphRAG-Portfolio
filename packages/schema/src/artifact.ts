import { Schema } from 'effect';
import { EdgeId, EdgeType, NodeId, NodeType } from './ids.ts';
import { PlainTime } from './time.ts';

export const Vec3 = Schema.Tuple([Schema.Number, Schema.Number, Schema.Number]);
export type Vec3 = typeof Vec3.Type;

/** A Node as it ships in `graph.json`: frontmatter fields flattened, plus derived data. */
export const ArtifactNode = Schema.Struct({
  id: NodeId,
  type: NodeType,
  title: Schema.String,
  summary: Schema.optionalKey(Schema.String),
  hidden: Schema.Boolean,
  /** Markdown body written for the LLM. */
  body: Schema.String,
  aliases: Schema.optionalKey(Schema.Array(Schema.String)),
  /** Type-specific scalar fields (role, degree, category, url, ...). */
  fields: Schema.Record(
    Schema.String,
    Schema.Union([Schema.String, Schema.Number, Schema.Boolean]),
  ),
  links: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  languages: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  start: Schema.optionalKey(PlainTime),
  end: Schema.optionalKey(PlainTime),
  /** Derived Span for Skills; never authored. ADR 0001. */
  span: Schema.optionalKey(Schema.Struct({ start: PlainTime, end: Schema.optionalKey(PlainTime) })),
  degree: Schema.Number,
  /** Layout position, precomputed at index time. */
  position: Vec3,
});
export type ArtifactNode = typeof ArtifactNode.Type;

export const ArtifactEdge = Schema.Struct({
  id: EdgeId,
  source: NodeId,
  target: NodeId,
  type: EdgeType,
  note: Schema.optionalKey(Schema.String),
  /** The sentence that was embedded: the note or the template sentence. */
  text: Schema.String,
});
export type ArtifactEdge = typeof ArtifactEdge.Type;

export const ArtifactMeta = Schema.Struct({
  version: Schema.Literal(1),
  generatedAt: Schema.String,
  embedding: Schema.Struct({ model: Schema.String, dimensions: Schema.Number }),
  /** SHA-256 over the content inputs, for eval result provenance. */
  contentHash: Schema.String,
});

/** `packages/graph-index/generated/graph.json`. Vectors ship separately as `*-embeddings.bin`. */
export const GraphArtifact = Schema.Struct({
  meta: ArtifactMeta,
  nodes: Schema.Array(ArtifactNode),
  edges: Schema.Array(ArtifactEdge),
});
export type GraphArtifact = typeof GraphArtifact.Type;
export type GraphArtifactEncoded = typeof GraphArtifact.Encoded;

/** `generated/hints.json`: authored hints with their precomputed candidate Node ids. */
export const Hint = Schema.Struct({
  id: Schema.String,
  prompt: Schema.String,
  candidateIds: Schema.Array(NodeId),
});
export type Hint = typeof Hint.Type;
export const HintsArtifact = Schema.Array(Hint);
export type HintsArtifact = typeof HintsArtifact.Type;

export const decodeArtifact = Schema.decodeUnknownEffect(GraphArtifact);
export const encodeArtifact = Schema.encodeSync(GraphArtifact);
