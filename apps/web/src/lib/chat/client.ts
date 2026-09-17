import type { TurnEvent, TurnRequest } from '@graphrag/schema';

/** Reads the NDJSON body of `POST /api/turn` event by event. ADR 0003. */
export const streamTurn = async (
  request: TurnRequest,
  signal: AbortSignal,
  onEvent: (e: TurnEvent) => void,
): Promise<void> => {
  const res = await fetch('/api/turn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal,
  });
  if (!res.body) {
    onEvent({
      type: 'error',
      tag: 'internal',
      message: `empty response (${res.status})`,
      retryable: true,
    });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const emitLines = (flush: boolean) => {
    const lines = buf.split('\n');
    buf = flush ? '' : (lines.pop() ?? '');
    for (const line of lines) {
      if (!line.trim()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      onEvent(parsed as TurnEvent);
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    emitLines(false);
  }
  buf += decoder.decode();
  emitLines(true);
};
