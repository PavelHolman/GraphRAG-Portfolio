import { Effect } from 'effect';
import YAML from 'yaml';
import { exists, listDir, pathJoin, readText } from './fs.ts';

/** Prompts of the eval cases, so their query vectors are cached at index time. `docs/spec/evals.md`. */
export const evalPrompts = (casesDir: string) =>
  Effect.gen(function* () {
    if (!(yield* exists(casesDir))) return [] as Array<string>;
    const files = (yield* listDir(casesDir)).filter((f) => f.endsWith('.yaml')).sort();
    const out: Array<string> = [];
    for (const f of files) {
      const raw = yield* readText(pathJoin(casesDir, f));
      const parsed = yield* Effect.try({
        try: () => YAML.parse(raw) as { prompt?: unknown },
        catch: () => undefined,
      }).pipe(Effect.catch(() => Effect.succeed(undefined)));
      if (parsed && typeof parsed.prompt === 'string') out.push(parsed.prompt);
    }
    return out;
  });
