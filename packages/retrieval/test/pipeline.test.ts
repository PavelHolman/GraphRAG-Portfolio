import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { LocalHashingEmbedderLayer } from '../src/adapters/local-hashing-embedder.ts';
import { classify } from '../src/classify.ts';
import { BUDGET, expand } from '../src/expand.ts';
import { seed } from '../src/seed.ts';
import { fixtureIndex } from './fixture.ts';

const graph = fixtureIndex();
const ids = (xs: Iterable<number>) => [...xs].map((i) => graph.nodes[i]?.id);

const run = (prompt: string, previous: Array<never> = []) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const cls = classify(prompt, graph);
      const s = yield* seed(prompt, cls, previous, graph);
      return { cls, seeds: s, candidate: expand(s, cls.mode, graph) };
    }).pipe(Effect.provide(LocalHashingEmbedderLayer)),
  );

describe('seed + expand', () => {
  test('entity: the matched Node seeds and its one-hop neighbourhood becomes the candidate', async () => {
    const r = await run('Tell me about your Effect work');
    expect(ids(r.seeds.nodes.keys())).toEqual(['skill/effect']);
    const cand = ids(r.candidate.nodes.keys());
    expect(cand).toContain('project/ingestion');
    expect(cand).toContain('experience/staff-engineer');
    expect(cand).toContain('person/pavel');
    expect(cand).not.toContain('education/msc');
    expect(r.candidate.edges.size).toBeGreaterThan(0);
  });
  test('hybrid: vector seeds land on lexically related Nodes', async () => {
    const r = await run('which project ingests events per second with streams');
    expect(r.cls.mode).toBe('hybrid');
    expect(ids(r.seeds.nodes.keys())).toContain('project/ingestion');
  });
  test('match: two hops, restricted seed types', async () => {
    const jd = [
      'Platform lead role.',
      '- Run production workloads on Kubernetes container orchestration',
      '- Event streaming platform experience such as Kafka',
      '- Typed JavaScript for large codebases',
      '- Mentor engineers',
    ].join('\n');
    const r = await run(jd);
    expect(r.cls.mode).toBe('match');
    for (const i of r.seeds.nodes.keys())
      expect(['skill', 'experience', 'education']).toContain(graph.nodes[i]?.type ?? '');
    expect(ids(r.seeds.nodes.keys())).toContain('skill/kubernetes');
    expect(ids(r.candidate.nodes.keys())).toContain('organization/acme');
  });
  test('hidden Nodes are never candidates; Person always is', async () => {
    const r = await run('Tell me about your Staff Engineer role');
    const cand = ids(r.candidate.nodes.keys());
    expect(cand).not.toContain('skill/secret');
    expect(cand).toContain('person/pavel');
  });
  test('no seed clears the threshold: fall back to Person plus top-degree Nodes', async () => {
    const r = await run('zzzz qqqq wwww');
    expect(r.seeds.fallback).toBe(true);
    expect(ids(r.seeds.nodes.keys())[0]).toBe('person/pavel');
  });
  test('budget caps are respected', async () => {
    const r = await run('Tell me about your Effect work');
    expect(r.candidate.nodes.size).toBeLessThanOrEqual(BUDGET.nodes);
    expect(r.candidate.edges.size).toBeLessThanOrEqual(BUDGET.edges);
  });
});
