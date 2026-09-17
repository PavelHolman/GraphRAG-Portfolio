import { Schema } from 'effect';
import { EdgeId, GraphId, NodeId } from './ids.ts';

export const LIMITS = {
  promptChars: 8_000,
  historyTurns: 3,
  historyChars: 6_000,
  previousUsedIds: 60,
} as const;

export const TurnMode = Schema.Literals(['match', 'entity', 'hybrid']);
export type TurnMode = typeof TurnMode.Type;

export const Tier = Schema.Literals(['primary', 'economy']);
export type Tier = typeof Tier.Type;

export const HistoryTurn = Schema.Struct({ prompt: Schema.String, answer: Schema.String });
export type HistoryTurn = typeof HistoryTurn.Type;

/** `POST /api/turn` body. ADR 0003, limits per `docs/spec/hardening.md`. */
export const TurnRequest = Schema.Struct({
  prompt: Schema.String.pipe(
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(LIMITS.promptChars)),
  ),
  previousUsedIds: Schema.optionalKey(
    Schema.Array(GraphId).pipe(Schema.check(Schema.isMaxLength(LIMITS.previousUsedIds))),
  ),
  history: Schema.optionalKey(
    Schema.Array(HistoryTurn).pipe(
      Schema.check(
        Schema.isMaxLength(LIMITS.historyTurns),
        Schema.makeFilter(
          (h: ReadonlyArray<HistoryTurn>) =>
            h.reduce((n, t) => n + t.prompt.length + t.answer.length, 0) <= LIMITS.historyChars ||
            `history exceeds ${LIMITS.historyChars} characters`,
        ),
      ),
    ),
  ),
  /** Prompt provenance for telemetry only. */
  source: Schema.optionalKey(Schema.Literals(['typed', 'hint', 'followup'])),
  /** Turnstile hook point, ignored until enabled. */
  turnstile: Schema.optionalKey(Schema.String),
});
export type TurnRequest = typeof TurnRequest.Type;

export const Usage = Schema.Struct({ tokensIn: Schema.Number, tokensOut: Schema.Number });
export type Usage = typeof Usage.Type;

export const TurnErrorTag = Schema.Literals([
  'input-too-large',
  'input-invalid',
  'rate-limited',
  'budget-exhausted',
  'upstream',
  'internal',
]);
export type TurnErrorTag = typeof TurnErrorTag.Type;

/** One NDJSON line of the Turn stream. ADR 0003. */
export const TurnEvent = Schema.Union([
  Schema.Struct({
    type: Schema.Literal('turn-started'),
    turnId: Schema.String,
    mode: TurnMode,
    tier: Tier,
  }),
  Schema.Struct({
    type: Schema.Literal('subgraph'),
    nodeIds: Schema.Array(NodeId),
    edgeIds: Schema.Array(EdgeId),
    seedIds: Schema.Array(NodeId),
  }),
  Schema.Struct({ type: Schema.Literal('text'), delta: Schema.String }),
  Schema.Struct({ type: Schema.Literal('citation'), id: GraphId, ordinal: Schema.Number }),
  Schema.Struct({ type: Schema.Literal('followups'), prompts: Schema.Array(Schema.String) }),
  Schema.Struct({
    type: Schema.Literal('turn-finished'),
    usedNodeIds: Schema.Array(NodeId),
    usedEdgeIds: Schema.Array(EdgeId),
    usage: Usage,
  }),
  Schema.Struct({
    type: Schema.Literal('error'),
    tag: TurnErrorTag,
    message: Schema.String,
    retryable: Schema.Boolean,
    retryAfterSeconds: Schema.optionalKey(Schema.Number),
    resetAt: Schema.optionalKey(Schema.String),
  }),
]);
export type TurnEvent = typeof TurnEvent.Type;
export type TurnEventOf<T extends TurnEvent['type']> = Extract<TurnEvent, { type: T }>;

export const decodeTurnEvent = Schema.decodeUnknownSync(TurnEvent);
export const decodeTurnEventExit = Schema.decodeUnknownExit(TurnEvent);
export const encodeTurnEvent = Schema.encodeSync(TurnEvent);
export const decodeTurnRequest = Schema.decodeUnknownEffect(TurnRequest);
