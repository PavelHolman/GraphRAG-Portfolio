import { Stream } from 'effect';
import { type TurnEvent, encodeTurnEvent } from '@graphrag/schema';

/** One JSON object per line. ADR 0003. */
export const toNdjson = <E, R>(
  events: Stream.Stream<TurnEvent, E, R>,
): Stream.Stream<Uint8Array, E, R> =>
  events.pipe(
    Stream.map((e) => `${JSON.stringify(encodeTurnEvent(e))}\n`),
    Stream.encodeText,
  );
