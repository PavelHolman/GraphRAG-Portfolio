import { Effect, Stream } from 'effect';
import { decodeTurnRequest, encodeTurnEvent, type TurnEvent } from '@graphrag/schema';
import { GraphArtifact, toNdjson, turn } from '@graphrag/retrieval';
import type { RequestHandler } from './$types';
import { loadGraphIndex } from '$lib/server/artifact.ts';
import { runtimeLayer } from '$lib/server/layers.ts';

const HEADERS = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-store',
};

const errorResponse = (status: number, event: TurnEvent) =>
  new Response(`${JSON.stringify(encodeTurnEvent(event))}\n`, { status, headers: HEADERS });

/** Pass-through from HTTP to the retrieval Stream. ADR 0002, ADR 0003. */
export const POST: RequestHandler = async (event) => {
  const json = await event.request.json().catch(() => null);
  const decoded = await Effect.runPromiseExit(decodeTurnRequest(json));
  if (decoded._tag === 'Failure') {
    const message = String(decoded.cause).replace(/\s+/g, ' ').slice(0, 300);
    const tag = /8000|6000|MaxLength|isMaxLength/.test(message)
      ? 'input-too-large'
      : 'input-invalid';
    return errorResponse(400, { type: 'error', tag, message, retryable: false });
  }
  const request = decoded.value;

  const program = Effect.gen(function* () {
    const index = yield* loadGraphIndex(event);
    const layer = yield* runtimeLayer(event.platform?.env);
    const events = turn(request).pipe(
      Stream.provideService(GraphArtifact, index),
      Stream.provide(layer),
    );
    return yield* toNdjson(events).pipe(Stream.toReadableStreamEffect());
  });

  const body = await Effect.runPromise(program, { signal: event.request.signal });
  return new Response(body, { headers: HEADERS });
};
