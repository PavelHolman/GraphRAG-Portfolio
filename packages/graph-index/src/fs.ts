// File access goes through Effect's `FileSystem` service, with `@effect/platform-node`'s layer
// provided by the CLI, the eval runner and the tests. This is the one helper the service does not
// offer; everything else calls it directly.
import { Effect, FileSystem } from 'effect';

/** The file's contents as text, or undefined when it does not exist. */
export const readTextIfExists = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return (yield* fs.exists(path)) ? yield* fs.readFileString(path) : undefined;
  });
