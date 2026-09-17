// Eval runner. Retrieval tier (default): deterministic, no LLM, fails on any miss.
// Answer tier (--answers): live model, N runs per case, writes evals/results/<date>-<model>.{json,md}.
// docs/spec/evals.md.
import 'temporal-polyfill/global';
import { Effect, Layer, Schema, Stream } from 'effect';
import YAML from 'yaml';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { TurnEvent } from '@graphrag/schema';
import { loadGraphIndex } from '@graphrag/graph-index';
import { GraphArtifact, retrieve, turn } from '../src/index.ts';
import {
  LOCAL_HASHING_MODEL,
  LocalHashingEmbedderLayer,
  OpenAiCompatLanguageModelLayer,
  WorkersAiRestEmbedderLayer,
  workersAiBaseUrl,
} from '../src/adapters/index.ts';

const root = join(import.meta.dir, '..', '..', '..');
const CASES = join(root, 'evals', 'cases');
const RESULTS = join(root, 'evals', 'results');
const GENERATED = join(root, 'packages', 'graph-index', 'generated');

const Case = Schema.Struct({
  id: Schema.String,
  mode: Schema.Literals(['match', 'entity', 'hybrid']),
  prompt: Schema.String,
  history: Schema.optionalKey(
    Schema.Array(Schema.Struct({ prompt: Schema.String, answer: Schema.String })),
  ),
  previousUsedIds: Schema.optionalKey(Schema.Array(Schema.String)),
  retrieval: Schema.Struct({
    must_seed: Schema.optionalKey(Schema.Array(Schema.String)),
    must_include: Schema.optionalKey(Schema.Array(Schema.String)),
    must_exclude: Schema.optionalKey(Schema.Array(Schema.String)),
    max_nodes: Schema.optionalKey(Schema.Number),
  }),
  answer: Schema.optionalKey(
    Schema.Struct({
      must_cite: Schema.optionalKey(Schema.Array(Schema.String)),
      must_not_cite: Schema.optionalKey(Schema.Array(Schema.String)),
      decline: Schema.optionalKey(Schema.Boolean),
      shape: Schema.optionalKey(Schema.Literals(['table', 'prose', 'decline'])),
      runs: Schema.optionalKey(Schema.Number),
      min_pass: Schema.optionalKey(Schema.Number),
    }),
  ),
});
type Case = typeof Case.Type;

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const answers = args.includes('--answers');
const onlyCase = flag('--case');
const runsOverride = flag('--runs');
const modelOverride = flag('--model');

const loadCases = Effect.promise(async () => {
  const files = (await readdir(CASES)).filter((f) => f.endsWith('.yaml')).sort();
  const out: Array<Case> = [];
  for (const f of files) {
    const raw = YAML.parse(await readFile(join(CASES, f), 'utf8')) as unknown;
    const c = Schema.decodeUnknownSync(Case)(raw);
    if (!onlyCase || c.id === onlyCase) out.push(c);
  }
  return out;
});

const main = Effect.gen(function* () {
  const index = yield* loadGraphIndex(GENERATED);
  const cases = yield* loadCases;
  const known = new Set([...index.nodes.map((n) => n.id), ...index.edges.map((e) => e.id)]);
  const token = process.env.WORKERS_AI_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const model = index.artifact.meta.embedding.model;
  const embedder =
    model === LOCAL_HASHING_MODEL
      ? LocalHashingEmbedderLayer
      : token && accountId
        ? WorkersAiRestEmbedderLayer({ accountId, token })
        : undefined;
  if (!embedder) {
    console.error(
      `artifact was embedded with ${model}; set WORKERS_AI_TOKEN and CLOUDFLARE_ACCOUNT_ID`,
    );
    return 1;
  }
  const base = Layer.merge(embedder, GraphArtifact.layer(index));

  const misses: Array<string> = [];
  for (const c of cases) {
    for (const id of [
      ...(c.retrieval.must_seed ?? []),
      ...(c.retrieval.must_include ?? []),
      ...(c.retrieval.must_exclude ?? []),
      ...(c.answer?.must_cite ?? []),
      ...(c.answer?.must_not_cite ?? []),
    ]) {
      if (!known.has(id)) misses.push(`${c.id}: unknown id ${id}`);
    }
  }
  if (misses.length) {
    for (const m of misses) console.error(m);
    return 1;
  }

  // Retrieval tier.
  const rows: Array<{ id: string; ok: boolean; problems: Array<string> }> = [];
  for (const c of cases) {
    const r = yield* retrieve({
      prompt: c.prompt,
      ...(c.history ? { history: c.history } : {}),
      ...(c.previousUsedIds ? { previousUsedIds: c.previousUsedIds as never } : {}),
    }).pipe(Effect.provide(base));
    const seeds = new Set(r.candidate.seeds.map((i) => index.nodes[i]?.id));
    const cand = new Set([...r.candidate.nodes.keys()].map((i) => index.nodes[i]?.id));
    const problems: Array<string> = [];
    if (r.classification.mode !== c.mode)
      problems.push(`mode ${r.classification.mode}, expected ${c.mode}`);
    for (const id of c.retrieval.must_seed ?? [])
      if (!seeds.has(id as never)) problems.push(`missing seed ${id}`);
    for (const id of c.retrieval.must_include ?? [])
      if (!cand.has(id as never)) problems.push(`missing candidate ${id}`);
    for (const id of c.retrieval.must_exclude ?? [])
      if (cand.has(id as never)) problems.push(`unexpected candidate ${id}`);
    if (c.retrieval.max_nodes !== undefined && cand.size > c.retrieval.max_nodes)
      problems.push(`${cand.size} candidates > ${c.retrieval.max_nodes}`);
    rows.push({ id: c.id, ok: problems.length === 0, problems });
  }
  const failed = rows.filter((r) => !r.ok);
  console.log(`retrieval tier: ${rows.length - failed.length}/${rows.length} pass`);
  for (const r of failed) console.log(`  ✗ ${r.id}: ${r.problems.join('; ')}`);
  if (!answers) return failed.length ? 1 : 0;

  // Answer tier.
  if (!token || !accountId) {
    console.error('answer tier needs WORKERS_AI_TOKEN and CLOUDFLARE_ACCOUNT_ID');
    return 1;
  }
  const llmModel =
    modelOverride ?? process.env.LLM_MODEL ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const lm = OpenAiCompatLanguageModelLayer({
    baseUrl: workersAiBaseUrl(accountId),
    apiKey: token,
    model: llmModel,
  });
  const layer = Layer.merge(base, lm);
  const results: Array<Record<string, unknown>> = [];
  let anyFail = false;
  for (const c of cases) {
    if (!c.answer) continue;
    const runs = Number(runsOverride ?? c.answer.runs ?? 3);
    const minPass = c.answer.min_pass ?? runs;
    let passes = 0;
    const perRun: Array<Record<string, unknown>> = [];
    for (let k = 0; k < runs; k++) {
      const started = performance.now();
      const events = yield* turn({
        prompt: c.prompt,
        ...(c.history ? { history: c.history } : {}),
      }).pipe(Stream.runCollect, Effect.provide(layer));
      const cited = new Set(
        events
          .filter((e): e is Extract<TurnEvent, { type: 'citation' }> => e.type === 'citation')
          .map((e) => e.id),
      );
      const text = events
        .filter((e): e is Extract<TurnEvent, { type: 'text' }> => e.type === 'text')
        .map((e) => e.delta)
        .join('');
      const fin = events.find(
        (e): e is Extract<TurnEvent, { type: 'turn-finished' }> => e.type === 'turn-finished',
      );
      const err = events.find(
        (e): e is Extract<TurnEvent, { type: 'error' }> => e.type === 'error',
      );
      const problems: Array<string> = [];
      if (err) problems.push(`error ${err.tag}: ${err.message}`);
      for (const id of c.answer.must_cite ?? [])
        if (!cited.has(id as never)) problems.push(`missing citation ${id}`);
      for (const id of c.answer.must_not_cite ?? [])
        if (cited.has(id as never)) problems.push(`unexpected citation ${id}`);
      const declined = cited.size === 0 && text.length < 400;
      if (c.answer.decline === true && !declined) problems.push('expected a decline');
      if (c.answer.decline === false && declined) problems.push('unexpected decline');
      if (c.answer.shape === 'table' && !/^\|.*\|$/m.test(text)) problems.push('expected a table');
      const ok = problems.length === 0;
      if (ok) passes++;
      perRun.push({
        ok,
        problems,
        cited: [...cited],
        declined,
        latencyMs: Math.round(performance.now() - started),
        usage: fin?.usage,
      });
    }
    const ok = passes >= minPass;
    if (!ok) anyFail = true;
    console.log(`${ok ? '✓' : '✗'} ${c.id}: ${passes}/${runs}`);
    results.push({ id: c.id, ok, passes, runs, minPass, perRun });
  }
  const date = Temporal.Now.plainDateISO().toString();
  const slug = llmModel.replace(/[^a-z0-9]+/gi, '-');
  yield* Effect.promise(() => mkdir(RESULTS, { recursive: true }));
  const summary = {
    date,
    model: llmModel,
    artifactHash: index.artifact.meta.contentHash,
    embeddingModel: model,
    results,
  };
  yield* Effect.promise(() =>
    writeFile(join(RESULTS, `${date}-${slug}.json`), `${JSON.stringify(summary, null, 2)}\n`),
  );
  const md = [
    '| case | pass | runs |',
    '| --- | --- | --- |',
    ...results.map(
      (r) => `| ${r.id} | ${r.ok ? '✓' : '✗'} ${r.passes}/${r.runs} | ${r.minPass} needed |`,
    ),
  ].join('\n');
  yield* Effect.promise(() =>
    writeFile(join(RESULTS, `${date}-${slug}.md`), `# ${date} ${llmModel}\n\n${md}\n`),
  );
  return anyFail ? 1 : 0;
});

process.exit(
  await Effect.runPromise(
    main.pipe(Effect.catchCause((c) => Effect.sync(() => (console.error(String(c)), 1)))),
  ),
);
