import 'temporal-polyfill/global';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import { Config, Effect, FileSystem, Layer } from 'effect';
import { NODE_TYPES, type NodeType } from '@graphrag/schema';
import { GraphArtifact, buildPrompt, retrieve } from '@graphrag/retrieval';
import {
  LocalHashingEmbedderLayer,
  WORKERS_AI_EMBEDDING_MODEL,
  WorkersAiRestEmbedderLayer,
} from '@graphrag/retrieval/adapters';
import { build, check, diffGenerated, readCache, writeGenerated } from './build.ts';
import { CacheOnlyEmbedderLayer } from './embed.ts';
import { join } from 'node:path';
import { loadGraphIndex } from './load-artifact.ts';
import { evalPrompts } from './eval-prompts.ts';

const root = join(import.meta.dir, '..', '..', '..');
const CONTENT_DIR = join(root, 'content');
const GENERATED_DIR = join(import.meta.dir, '..', 'generated');
const CACHE_FILE = join(import.meta.dir, '..', '.cache', 'embeddings.json');

const log = (line: string) => Effect.sync(() => console.log(line));
const err = (line: string) => Effect.sync(() => console.error(line));

/** Local: Workers AI REST when a token is present, else the lexical fallback (announced loudly). */
const pickEmbedder = Effect.gen(function* () {
  const token = yield* Config.withDefault(Config.String('WORKERS_AI_TOKEN'), '');
  const accountId = yield* Config.withDefault(Config.String('CLOUDFLARE_ACCOUNT_ID'), '');
  if (token && accountId) {
    yield* log(`embedder: ${WORKERS_AI_EMBEDDING_MODEL} (Workers AI REST)`);
    return WorkersAiRestEmbedderLayer({ accountId, token });
  }
  yield* err(
    'warning: WORKERS_AI_TOKEN / CLOUDFLARE_ACCOUNT_ID not set; using the local hashing embedder. Re-run with a token before deploying.',
  );
  return LocalHashingEmbedderLayer;
});

const printIssues = (issues: ReadonlyArray<{ file: string; message: string }>) =>
  Effect.forEach(issues, (i) => err(`${i.file}: ${i.message}`));

const cmdCheck = Effect.gen(function* () {
  const { content, issues } = yield* check(CONTENT_DIR);
  if (issues.length > 0) {
    yield* printIssues(issues);
    return 1;
  }
  yield* log(`ok: ${content.nodes.length} Nodes, ${content.hints.length} hints`);
  return 0;
});

const cmdIndex = (verify: boolean) =>
  Effect.gen(function* () {
    const cache = yield* readCache(CACHE_FILE);
    const generatedAt = yield* Effect.clockWith((c) => c.currentTimeMillis).pipe(
      Effect.map((ms) => Temporal.Instant.fromEpochMilliseconds(ms).toString()),
    );
    // Verify answers from the committed cache only, under whatever model built it. CI never embeds.
    const first = Object.values(cache)[0];
    const layer = verify
      ? CacheOnlyEmbedderLayer(
          first?.model ?? WORKERS_AI_EMBEDDING_MODEL,
          first?.vector.length ?? 768,
        )
      : yield* pickEmbedder;
    const queries = yield* evalPrompts(join(root, 'evals', 'cases'));
    const result = yield* build(CONTENT_DIR, cache, { verify, generatedAt, queries }).pipe(
      Effect.provide(layer),
    );
    if (verify) {
      const problems = yield* diffGenerated(GENERATED_DIR, result);
      if (problems.length > 0) {
        yield* Effect.forEach(problems, (p) => err(`verify: ${p}`));
        yield* err('run `bun content:index` locally and commit generated/ and .cache/');
        return 1;
      }
      yield* log(
        `verified: ${result.artifact.nodes.length} Nodes, ${result.artifact.edges.length} Edges match the committed artifact`,
      );
      return 0;
    }
    yield* writeGenerated(GENERATED_DIR, CACHE_FILE, result);
    yield* log(
      `indexed: ${result.artifact.nodes.length} Nodes, ${result.artifact.edges.length} Edges, ${result.hints.length} hints; embedded ${result.embedded} new texts with ${result.artifact.meta.embedding.model}`,
    );
    return 0;
  }).pipe(
    Effect.catchTags({
      ContentInvalid: (e) => printIssues(e.issues).pipe(Effect.as(1)),
      CacheMiss: (e) =>
        err(
          `embedding cache misses (run \`bun content:index\` locally):\n  ${e.ids.join('\n  ')}`,
        ).pipe(Effect.as(1)),
      EmbedError: (e) => err(`embedding failed: ${e.message}`).pipe(Effect.as(1)),
    }),
  );

const cmdAsk = (prompt: string) =>
  Effect.gen(function* () {
    const index = yield* loadGraphIndex(GENERATED_DIR);
    const model = index.artifact.meta.embedding.model;
    const embedderLayer =
      model === WORKERS_AI_EMBEDDING_MODEL ? yield* pickEmbedder : LocalHashingEmbedderLayer;
    const r = yield* retrieve({ prompt }).pipe(
      Effect.provide(Layer.merge(embedderLayer, GraphArtifact.layer(index))),
    );
    yield* log(`mode: ${r.classification.mode}${r.seeds.fallback ? ' (fallback seeds)' : ''}`);
    yield* log('seeds:');
    for (const [i, w] of r.seeds.nodes) yield* log(`  ${index.nodes[i]?.id}  ${w.toFixed(3)}`);
    yield* log(`candidate Nodes (${r.candidate.nodes.size}):`);
    for (const [i, s] of [...r.candidate.nodes.entries()].sort((a, b) => b[1] - a[1])) {
      yield* log(`  ${index.nodes[i]?.id}  ${s.toFixed(3)}`);
    }
    yield* log(`candidate Edges (${r.candidate.edges.size}):`);
    for (const ei of r.candidate.edges) yield* log(`  ${index.edges[ei]?.id}`);
    const input = buildPrompt(prompt, r.classification.mode, r.candidate, [], index);
    yield* log('\n--- prompt template ---\n');
    yield* log(input.system);
    return 0;
  });

const TEMPLATES: Record<NodeType, string> = {
  person:
    'lede: One or two sentences for the About section.\nlocation: City, Country\nlinks:\n  email: mailto:you@example.com\n  github: https://github.com/you\n  linkedin: https://www.linkedin.com/in/you\nlanguages:\n  English: professional working proficiency\n# availability: Open to remote work',
  skill:
    'category: language | framework | platform | practice | leadership\naliases: []\n# part-of: [skill/broader]\n# related-to: [skill/other]',
  project:
    'start: 2024-01\nend: 2024-06\n# url: https://\n# repo: https://\nuses:\n  - { to: skill/example, note: concrete evidence of how it was used }\n# in-domain: [domain/example]',
  experience:
    'start: 2024-01\n# end: 2025-01\nrole: Job title\nemployment: full-time | part-time | contract | freelance | founder\nat: [organization/example]\nuses:\n  - { to: skill/example, note: concrete evidence of how it was used }\n# delivered: [project/example]\n# led: [project/example]\n# in-domain: [domain/example]',
  education:
    'start: 2015-09\nend: 2020-06\ndegree: MSc\nfield: Computer Science\nat: [organization/example]\n# taught: [skill/example]\n# delivered: [project/thesis]',
  organization:
    'kind: company | university | client | community\n# url: https://\n# location: City, Country\n# in-domain: [domain/example]',
  domain: 'aliases: []',
};

const cmdNew = (type: string, slug: string) =>
  Effect.gen(function* () {
    if (!(NODE_TYPES as ReadonlyArray<string>).includes(type)) {
      yield* err(`unknown type ${JSON.stringify(type)}; expected one of ${NODE_TYPES.join(', ')}`);
      return 1;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      yield* err(`slug must be lowercase [a-z0-9-], got ${JSON.stringify(slug)}`);
      return 1;
    }
    const fs = yield* FileSystem.FileSystem;
    const file = join(CONTENT_DIR, type, `${slug}.md`);
    if (yield* fs.exists(file)) {
      yield* err(`${file} already exists`);
      return 1;
    }
    const title = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    yield* fs.writeFileString(
      file,
      `---\ntitle: ${title}\nsummary: One line for labels and hover cards.\n${TEMPLATES[type as NodeType]}\n---\n\nDense, factual body written for the LLM: what, where, when, outcomes, numbers.\n`,
    );
    yield* log(`wrote ${file}`);
    return 0;
  });

const usage =
  'usage: content:check | content:index [--verify] | content:ask "<prompt>" | content:new <type> <slug>';

const main = Effect.gen(function* () {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'check':
      return yield* cmdCheck;
    case 'index':
      return yield* cmdIndex(rest.includes('--verify'));
    case 'ask':
      if (!rest[0]) {
        yield* err(usage);
        return 1;
      }
      return yield* cmdAsk(rest.join(' '));
    case 'new':
      if (!rest[0] || !rest[1]) {
        yield* err(usage);
        return 1;
      }
      return yield* cmdNew(rest[0], rest[1]);
    default:
      yield* err(usage);
      return 1;
  }
});

const code = await Effect.runPromise(
  main.pipe(
    Effect.provide(NodeFileSystem.layer),
    Effect.catchCause((cause) => err(`error: ${cause.toString()}`).pipe(Effect.as(1))),
  ),
);
process.exit(code);
