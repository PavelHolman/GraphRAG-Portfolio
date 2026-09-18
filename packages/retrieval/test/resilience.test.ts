import { describe, expect, test } from 'bun:test';
import { Effect } from 'effect';
import { EmbedError } from '../src/errors.ts';
import { retryUpstream, timeoutUpstream } from '../src/resilience.ts';

const failing = (retryable: boolean, succeedOnAttempt: number) => {
  let attempts = 0;
  const effect = Effect.suspend(() => {
    attempts += 1;
    return attempts >= succeedOnAttempt
      ? Effect.succeed(attempts)
      : Effect.fail(new EmbedError({ message: `attempt ${attempts}`, retryable }));
  });
  return { effect, attempts: () => attempts };
};

describe('retryUpstream', () => {
  test('leaves a non-retryable failure alone', async () => {
    const f = failing(false, 99);
    const exit = await Effect.runPromiseExit(retryUpstream(f.effect));
    expect(exit._tag).toBe('Failure');
    expect(f.attempts()).toBe(1);
  });
  test('retries a retryable failure until it succeeds', async () => {
    const f = failing(true, 2);
    expect(await Effect.runPromise(retryUpstream(f.effect))).toBe(2);
    expect(f.attempts()).toBe(2);
  });
  test('gives up after two retries and keeps the last failure', async () => {
    const f = failing(true, 99);
    const exit = await Effect.runPromiseExit(retryUpstream(f.effect));
    expect(exit._tag).toBe('Failure');
    expect(f.attempts()).toBe(3);
  });
});

describe('timeoutUpstream', () => {
  test('fails with the adapter own error when the call overruns', async () => {
    const slow = Effect.never as Effect.Effect<number, EmbedError>;
    const exit = await Effect.runPromiseExit(
      slow.pipe(
        timeoutUpstream(0.01, () => new EmbedError({ message: 'too slow', retryable: true })),
      ),
    );
    expect(exit._tag).toBe('Failure');
    expect(String(exit)).toContain('too slow');
  });
  test('leaves a call that finishes in time untouched', async () => {
    const quick = Effect.succeed(7) as Effect.Effect<number, EmbedError>;
    expect(
      await Effect.runPromise(
        quick.pipe(timeoutUpstream(5, () => new EmbedError({ message: 'x', retryable: true }))),
      ),
    ).toBe(7);
  });
});
