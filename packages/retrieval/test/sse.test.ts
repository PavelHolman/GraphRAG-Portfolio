import { describe, expect, test } from 'bun:test';
import { Effect, Stream } from 'effect';
import { sseToParts } from '../src/adapters/openai-compat-language-model.adapter.ts';

describe('sseToParts', () => {
  test('turns chat completion chunks into text and finish parts', async () => {
    const lines = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"lo"}}]}',
      'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":2}}',
      'data: [DONE]',
    ];
    const parts = await Effect.runPromise(
      sseToParts(Stream.fromArray(lines)).pipe(Stream.runCollect),
    );
    expect(parts).toEqual([
      { type: 'text', delta: 'Hel' },
      { type: 'text', delta: 'lo' },
      { type: 'finish', usage: { tokensIn: 10, tokensOut: 2 } },
    ]);
  });
  test('a stream that ends without [DONE] still finishes', async () => {
    const parts = await Effect.runPromise(
      sseToParts(Stream.fromArray(['data: {"choices":[{"delta":{"content":"x"}}]}'])).pipe(
        Stream.runCollect,
      ),
    );
    expect(parts.at(-1)?.type).toBe('finish');
  });
});
