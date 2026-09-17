import { describe, expect, test } from 'bun:test';
import { Effect, Exit } from 'effect';
import { LIMITS, decodeTurnEvent, decodeTurnRequest, encodeTurnEvent } from '../src/turn.ts';

describe('TurnRequest', () => {
  test('accepts a plain prompt', async () => {
    const r = await Effect.runPromise(decodeTurnRequest({ prompt: 'hi' }));
    expect(r.prompt).toBe('hi');
  });
  test('rejects a prompt over the limit and a history over the character budget', async () => {
    const big = await Effect.runPromiseExit(
      decodeTurnRequest({ prompt: 'x'.repeat(LIMITS.promptChars + 1) }),
    );
    expect(Exit.isFailure(big)).toBe(true);
    const hist = await Effect.runPromiseExit(
      decodeTurnRequest({
        prompt: 'q',
        history: [{ prompt: 'a'.repeat(4000), answer: 'b'.repeat(4000) }],
      }),
    );
    expect(Exit.isFailure(hist)).toBe(true);
  });
  test('rejects ids that are not Node or Edge ids', async () => {
    const r = await Effect.runPromiseExit(
      decodeTurnRequest({ prompt: 'q', previousUsedIds: ['nope'] }),
    );
    expect(Exit.isFailure(r)).toBe(true);
  });
});

describe('TurnEvent', () => {
  test('encodes and decodes every event kind', () => {
    const events = [
      { type: 'turn-started', turnId: 't1', mode: 'hybrid', tier: 'primary' },
      { type: 'subgraph', nodeIds: ['person/pavel'], edgeIds: [], seedIds: ['person/pavel'] },
      { type: 'text', delta: 'hello' },
      { type: 'citation', id: 'project/x--uses-->skill/y', ordinal: 0 },
      { type: 'followups', prompts: ['a'] },
      {
        type: 'turn-finished',
        usedNodeIds: [],
        usedEdgeIds: [],
        usage: { tokensIn: 1, tokensOut: 2 },
      },
      {
        type: 'error',
        tag: 'rate-limited',
        message: 'slow down',
        retryable: true,
        retryAfterSeconds: 10,
      },
    ] as const;
    for (const e of events) {
      const decoded = decodeTurnEvent(e);
      expect(JSON.parse(JSON.stringify(encodeTurnEvent(decoded)))).toEqual(e);
    }
  });
});
