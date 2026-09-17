import { Data } from 'effect';

export class EmbedError extends Data.TaggedError('EmbedError')<{
  readonly message: string;
  readonly retryable: boolean;
  readonly cause?: unknown;
}> {}

export class LanguageModelError extends Data.TaggedError('LanguageModelError')<{
  readonly message: string;
  readonly retryable: boolean;
  readonly cause?: unknown;
}> {}
