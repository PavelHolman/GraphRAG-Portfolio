import { Effect, FileSystem } from 'effect';
import YAML from 'yaml';
import { join } from 'node:path';

/** Prompts of the eval cases, so their query vectors are cached at index time. `docs/spec/evals.md`. */
export const evalPrompts = (casesDir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    if (!(yield* fs.exists(casesDir))) return [] as Array<string>;
    const files = (yield* fs.readDirectory(casesDir)).filter((f) => f.endsWith('.yaml')).sort();
    const out: Array<string> = [];
    for (const f of files) {
      const raw = yield* fs.readFileString(join(casesDir, f));
      const parsed = yield* Effect.try({
        try: () => YAML.parse(raw) as { prompt?: unknown },
        catch: () => undefined,
      }).pipe(Effect.catch(() => Effect.succeed(undefined)));
      if (parsed && typeof parsed.prompt === 'string') out.push(parsed.prompt);
    }
    return out;
  });
