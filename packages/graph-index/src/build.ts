import { Data, Effect, Schema } from 'effect';
import type {
  ArtifactEdge,
  ArtifactNode,
  GraphArtifact as Artifact,
  Hint,
  NodeId,
  Vec3,
} from '@graphrag/schema';
import {
  Frontmatter,
  GraphArtifact as ArtifactSchema,
  HintsArtifact,
  encodeArtifact,
} from '@graphrag/schema';
import {
  Embedder,
  GraphArtifact,
  makeGraphIndex,
  requirementLines,
  retrieve,
  type GraphIndex,
} from '@graphrag/retrieval';
import { CachedTextEmbedderLayer } from '@graphrag/retrieval/adapters';
import { deriveSpans } from './derive.ts';
import { CacheMiss, EmbeddingCache, edgeText, embedWithCache, nodeText, sha256 } from './embed.ts';
import { ensureDir, pathJoin, readBytes, readTextIfExists, writeBytes, writeText } from './fs.ts';
import { forceLayout } from './layout.ts';
import { type ContentIssue, type LoadedContent, type LoadedNode, loadContent } from './load.ts';
import { validate } from './validate.ts';

export class ContentInvalid extends Data.TaggedError('ContentInvalid')<{
  readonly issues: ReadonlyArray<ContentIssue>;
}> {}

export interface BuildResult {
  readonly artifact: Artifact;
  readonly nodeVectors: Float32Array;
  readonly edgeVectors: Float32Array;
  readonly hints: ReadonlyArray<Hint>;
  readonly cache: EmbeddingCache;
  readonly embedded: number;
  readonly index: GraphIndex;
}

const SCALAR_FIELDS = [
  'category',
  'role',
  'employment',
  'degree',
  'field',
  'url',
  'repo',
  'location',
  'kind',
  'lede',
] as const;

const toArtifactNode = (
  n: LoadedNode,
  degree: number,
  span: { start: unknown; end?: unknown } | undefined,
  position: Vec3,
): ArtifactNode => {
  const fm = n.frontmatter as Record<string, unknown>;
  const fields: Record<string, string | number | boolean> = {};
  for (const k of SCALAR_FIELDS) {
    const v = fm[k];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') fields[k] = v;
  }
  const node: ArtifactNode = {
    id: n.id,
    type: n.type,
    title: n.frontmatter.title,
    hidden: n.frontmatter.hidden,
    body: n.body,
    fields,
    degree,
    position,
    ...(n.frontmatter.summary !== undefined ? { summary: n.frontmatter.summary } : {}),
    ...(Array.isArray(fm.aliases) ? { aliases: fm.aliases as Array<string> } : {}),
    ...(fm.links && typeof fm.links === 'object'
      ? { links: fm.links as Record<string, string> }
      : {}),
    ...(fm.start !== undefined ? { start: fm.start as NonNullable<ArtifactNode['start']> } : {}),
    ...(fm.end !== undefined ? { end: fm.end as NonNullable<ArtifactNode['end']> } : {}),
    ...(span ? { span: span as NonNullable<ArtifactNode['span']> } : {}),
  };
  return node;
};

/** `content:check`: load and validate, no network. */
export const check = (contentDir: string) =>
  Effect.gen(function* () {
    const content = yield* loadContent(contentDir);
    const validated = validate(content.nodes);
    return { content, validated, issues: [...content.issues, ...validated.issues] };
  });

/** `content:index`: the whole build. Requires an Embedder. ADR 0002. */
export const build = (
  contentDir: string,
  cache: EmbeddingCache,
  options: {
    readonly verify: boolean;
    readonly generatedAt: string;
    /** Prompts whose query vectors are cached too (eval cases), so `bun eval` runs offline. */
    readonly queries?: ReadonlyArray<string>;
  },
) =>
  Effect.gen(function* () {
    const { content, validated, issues } = yield* check(contentDir);
    if (issues.length > 0) return yield* new ContentInvalid({ issues });
    const { nodes } = content;
    const { edges } = validated;
    const titles = new Map<NodeId, string>(nodes.map((n) => [n.id, n.frontmatter.title]));
    const spans = deriveSpans(nodes, edges);
    const degree = new Map<NodeId, number>();
    for (const e of edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    const nodeIndex = new Map<NodeId, number>(nodes.map((n, i) => [n.id, i]));
    const positions = yield* Effect.sync(() =>
      forceLayout({
        types: nodes.map((n) => n.type),
        edges: edges.map(
          (e) => [nodeIndex.get(e.source) ?? 0, nodeIndex.get(e.target) ?? 0] as const,
        ),
      }),
    ).pipe(Effect.withSpan('layout'));

    // Hint prompts and eval-case queries (plus their requirement lines, which match mode embeds one
    // by one) are cached as well, so hints rebuild and `bun eval` runs offline in CI.
    const queryTexts = new Set<string>();
    for (const q of [...content.hints.map((h) => h.prompt), ...(options.queries ?? [])]) {
      queryTexts.add(q);
      queryTexts.add(q.slice(0, 2000));
      for (const line of requirementLines(q)) queryTexts.add(line);
    }
    const queryItems: Array<{ id: string; text: string }> = [];
    for (const text of queryTexts) queryItems.push({ id: `query:${yield* sha256(text)}`, text });
    const items = [
      ...nodes.map((n) => ({ id: n.id, text: nodeText(n) })),
      ...edges.map((e) => ({ id: e.id, text: edgeText(e, titles) })),
      ...queryItems,
    ];
    const embedded = yield* embedWithCache(items, cache, { verify: options.verify }).pipe(
      Effect.withSpan('embed'),
    );
    const dims = embedded.dimensions;
    const nodeVectors = embedded.vectors.slice(0, nodes.length * dims);
    const edgeVectors = embedded.vectors.slice(
      nodes.length * dims,
      (nodes.length + edges.length) * dims,
    );
    const queryVectors = new Map<string, Float32Array>();
    queryItems.forEach((q, i) => {
      const off = (nodes.length + edges.length + i) * dims;
      queryVectors.set(q.id.slice('query:'.length), embedded.vectors.slice(off, off + dims));
    });
    const hintEmbedder = CachedTextEmbedderLayer(embedded.model, dims, queryVectors);

    const contentHash = yield* sha256(
      content.sources.map((s) => `${s.path}\n${s.text}`).join('\n=====\n'),
    );
    const artifactNodes = nodes.map((n, i) =>
      toArtifactNode(n, degree.get(n.id) ?? 0, spans.get(n.id), positions[i] ?? [0, 0, 0]),
    );
    const artifactEdges: Array<ArtifactEdge> = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      text: edgeText(e, titles),
      ...(e.note !== undefined ? { note: e.note } : {}),
    }));
    const artifact: Artifact = {
      meta: {
        version: 1,
        generatedAt: options.generatedAt,
        embedding: { model: embedded.model, dimensions: dims },
        contentHash,
      },
      nodes: artifactNodes,
      edges: artifactEdges,
    };
    const index = makeGraphIndex(artifact, nodeVectors, edgeVectors);

    const hints: Array<Hint> = [];
    for (const h of content.hints) {
      const r = yield* retrieve({ prompt: h.prompt }).pipe(
        Effect.provideService(GraphArtifact, index),
        Effect.provide(hintEmbedder),
      );
      const candidateIds = [...r.candidate.nodes.keys()]
        .map((i) => index.nodes[i]?.id)
        .filter((id): id is NodeId => id !== undefined);
      hints.push({ id: h.id, prompt: h.prompt, candidateIds });
    }

    return {
      artifact,
      nodeVectors,
      edgeVectors,
      hints,
      cache: embedded.cache,
      embedded: embedded.embedded,
      index,
    } satisfies BuildResult;
  });

export const GENERATED_FILES = {
  graph: 'graph.json',
  nodeVectors: 'node-embeddings.bin',
  edgeVectors: 'edge-embeddings.bin',
  hints: 'hints.json',
  schema: 'content.schema.json',
} as const;

const toLittleEndian = (v: Float32Array): Uint8Array => {
  const out = new Uint8Array(v.length * 4);
  const view = new DataView(out.buffer);
  v.forEach((x, i) => view.setFloat32(i * 4, x, true));
  return out;
};

export const fromLittleEndian = (bytes: Uint8Array): Float32Array => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Float32Array(bytes.byteLength / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
};

export const stringifyArtifact = (a: Artifact) => `${JSON.stringify(encodeArtifact(a), null, 0)}\n`;

const jsonSchema = Effect.sync(() => {
  const doc = Schema.toJsonSchemaDocument(Frontmatter);
  return `${JSON.stringify(doc, null, 2)}\n`;
}).pipe(Effect.catchCause(() => Effect.succeed(undefined)));

export const writeGenerated = (generatedDir: string, cacheFile: string, r: BuildResult) =>
  Effect.gen(function* () {
    yield* ensureDir(generatedDir);
    yield* writeText(pathJoin(generatedDir, GENERATED_FILES.graph), stringifyArtifact(r.artifact));
    yield* writeBytes(
      pathJoin(generatedDir, GENERATED_FILES.nodeVectors),
      toLittleEndian(r.nodeVectors),
    );
    yield* writeBytes(
      pathJoin(generatedDir, GENERATED_FILES.edgeVectors),
      toLittleEndian(r.edgeVectors),
    );
    yield* writeText(
      pathJoin(generatedDir, GENERATED_FILES.hints),
      `${JSON.stringify(Schema.encodeSync(HintsArtifact)(r.hints), null, 0)}\n`,
    );
    const js = yield* jsonSchema;
    if (js !== undefined) yield* writeText(pathJoin(generatedDir, GENERATED_FILES.schema), js);
    yield* ensureDir(pathJoin(cacheFile, '..'));
    yield* writeText(cacheFile, `${JSON.stringify(r.cache)}\n`);
  });

export const readCache = (cacheFile: string) =>
  Effect.gen(function* () {
    const text = yield* readTextIfExists(cacheFile);
    if (text === undefined) return {} as EmbeddingCache;
    // A corrupt cache is not fatal: it is rebuilt from the embedder.
    return yield* Schema.fromJsonString(EmbeddingCache).pipe(
      Schema.decodeUnknownEffect,
      (decode) => decode(text),
      Effect.catchTag('SchemaError', () => Effect.succeed({} as EmbeddingCache)),
    );
  });

const bytesEqual = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** `content:index --verify`: rebuild from the committed cache and diff against the committed artifact. */
export const diffGenerated = (generatedDir: string, r: BuildResult) =>
  Effect.gen(function* () {
    const problems: Array<string> = [];
    const committedText = yield* readTextIfExists(pathJoin(generatedDir, GENERATED_FILES.graph));
    if (committedText === undefined) problems.push(`${GENERATED_FILES.graph} is missing`);
    else {
      // generatedAt is the only field allowed to differ between a rebuild and the committed file.
      const strip = (t: string) => t.replace(/"generatedAt":"[^"]*"/, '"generatedAt":""');
      if (strip(committedText) !== strip(stringifyArtifact(r.artifact))) {
        problems.push(`${GENERATED_FILES.graph} differs from a rebuild`);
      }
    }
    for (const [file, vec] of [
      [GENERATED_FILES.nodeVectors, r.nodeVectors],
      [GENERATED_FILES.edgeVectors, r.edgeVectors],
    ] as const) {
      const bytes = yield* readBytes(pathJoin(generatedDir, file)).pipe(
        Effect.catchTag('FsError', () => Effect.succeed(undefined)),
      );
      if (!bytes) problems.push(`${file} is missing`);
      else if (!bytesEqual(new Uint8Array(bytes), toLittleEndian(vec)))
        problems.push(`${file} differs from a rebuild`);
    }
    const hintsText = yield* readTextIfExists(pathJoin(generatedDir, GENERATED_FILES.hints));
    if (hintsText === undefined) problems.push(`${GENERATED_FILES.hints} is missing`);
    else if (hintsText.trim() !== JSON.stringify(Schema.encodeSync(HintsArtifact)(r.hints))) {
      problems.push(`${GENERATED_FILES.hints} differs from a rebuild`);
    }
    return problems;
  });

export { CacheMiss, Embedder, type LoadedContent };
export const decodeArtifactJson = Schema.decodeUnknownEffect(Schema.fromJsonString(ArtifactSchema));
