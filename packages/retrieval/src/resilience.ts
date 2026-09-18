// One retry and timeout policy for every upstream call. The adapters already tag each failure
// `retryable` and the wire format carries the flag to the browser; this is the half of that
// contract nothing implemented. `docs/spec/hardening.md`.
import { Duration, Effect, Schedule } from 'effect';

/** Attempts after the first. A Turn is a live request: two is the most a visitor waits through. */
const RETRIES = 2;
const BACKOFF = Duration.millis(300);

/** One embedding call. A Turn cannot start without it, so the bound is short. */
export const EMBED_TIMEOUT_SECONDS = 10;
/** Opening the model stream, before a single token has arrived. */
export const LM_OPEN_TIMEOUT_SECONDS = 15;
/** Silence between tokens once the Answer has started streaming. */
export const LM_IDLE_TIMEOUT_SECONDS = 30;

/**
 * Retries only what the adapter marked retryable, with jittered exponential backoff. A 429 or a
 * dropped connection is worth another attempt; a missing credential or a model mismatch is not.
 */
export const retryUpstream = <A, E extends { readonly retryable: boolean }, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  Effect.retry(effect, {
    schedule: Schedule.exponential(BACKOFF).pipe(Schedule.jittered),
    times: RETRIES,
    while: (error: E) => error.retryable,
  });

/** Bounds a call with the adapter's own error type, so a hung upstream still ends the Turn. */
export const timeoutUpstream =
  <E>(seconds: number, onTimeout: () => E) =>
  <A, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.timeoutOrElse(effect, {
      duration: Duration.seconds(seconds),
      orElse: () => Effect.fail(onTimeout()),
    });
