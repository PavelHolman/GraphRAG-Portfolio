import { describe, expect, test } from 'bun:test';
import { Effect, Layer, Stream } from 'effect';
import type { TurnEvent } from '@graphrag/schema';
import { LocalHashingEmbedderLayer } from '../src/adapters/local-hashing-embedder.ts';
import { ScriptedLanguageModelLayer } from '../src/adapters/scripted-language-model.ts';
import { toNdjson } from '../src/ndjson.ts';
import { GraphArtifact, LanguageModel } from '../src/services.ts';
import { turn } from '../src/turn.ts';
import { LanguageModelError } from '../src/errors.ts';
import { fixtureIndex } from './fixture.ts';

const layer = Layer.mergeAll(
  LocalHashingEmbedderLayer,
  ScriptedLanguageModelLayer,
  GraphArtifact.layer(fixtureIndex()),
);
const collect = (prompt: string) =>
  Effect.runPromise(turn({ prompt }).pipe(Stream.runCollect, Effect.provide(layer)));

describe('turn', () => {
  test('emits the ADR 0003 event order with validated citations', async () => {
    const events = await collect('Tell me about your Effect work');
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('turn-started');
    expect(types[1]).toBe('subgraph');
    expect(types.at(-1)).toBe('turn-finished');
    expect(types.indexOf('followups')).toBeGreaterThan(types.lastIndexOf('text'));
    const sub = events[1] as Extract<TurnEvent, { type: 'subgraph' }>;
    const candidate = new Set([...sub.nodeIds, ...sub.edgeIds]);
    const cites = events.filter(
      (e): e is Extract<TurnEvent, { type: 'citation' }> => e.type === 'citation',
    );
    expect(cites.length).toBeGreaterThan(0);
    for (const c of cites) expect(candidate.has(c.id)).toBe(true);
    expect(cites.map((c) => c.ordinal)).toEqual(cites.map((_, i) => i));
    const fin = events.at(-1) as Extract<TurnEvent, { type: 'turn-finished' }>;
    expect(new Set(fin.usedNodeIds).size + fin.usedEdgeIds.length).toBeGreaterThanOrEqual(
      new Set(cites.map((c) => c.id)).size,
    );
    expect(fin.usage.tokensOut).toBeGreaterThan(0);
    const text = events
      .filter((e) => e.type === 'text')
      .map((e) => (e as { delta: string }).delta)
      .join('');
    expect(text).not.toContain('[[');
    expect(text).not.toContain('```followups');
  });
  test('the NDJSON body has one event per line', async () => {
    const bytes = await Effect.runPromise(
      toNdjson(turn({ prompt: 'Where did you study?' })).pipe(
        Stream.runCollect,
        Effect.provide(layer),
      ),
    );
    const body = new TextDecoder().decode(Uint8Array.from(bytes.flatMap((b) => [...b])));
    const lines = body.trimEnd().split('\n');
    for (const l of lines) expect(() => JSON.parse(l)).not.toThrow();
    expect(JSON.parse(lines[0] ?? '{}').type).toBe('turn-started');
  });
  test('a LanguageModel failure becomes one terminal error event after the subgraph', async () => {
    const failing = Layer.succeed(LanguageModel, {
      model: 'broken',
      tier: 'primary',
      stream: () => Stream.fail(new LanguageModelError({ message: 'boom', retryable: true })),
    });
    const events = await Effect.runPromise(
      turn({ prompt: 'Tell me about Kafka' }).pipe(
        Stream.runCollect,
        Effect.provide(
          Layer.mergeAll(LocalHashingEmbedderLayer, failing, GraphArtifact.layer(fixtureIndex())),
        ),
      ),
    );
    expect(events.map((e) => e.type)).toEqual(['turn-started', 'subgraph', 'error']);
    expect(events[2]).toMatchObject({ tag: 'upstream', retryable: true });
  });
});
