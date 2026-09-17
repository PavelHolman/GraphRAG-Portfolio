import { Data, Effect } from 'effect';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export class FsError extends Data.TaggedError('FsError')<{
  readonly path: string;
  readonly message: string;
}> {}

const wrap = <A>(path: string, f: () => Promise<A>) =>
  Effect.tryPromise({ try: f, catch: (e) => new FsError({ path, message: String(e) }) });

export const readText = (path: string) => wrap(path, () => readFile(path, 'utf8'));
export const readBytes = (path: string) => wrap(path, () => readFile(path));
export const writeText = (path: string, text: string) =>
  wrap(path, () => writeFile(path, text, 'utf8'));
export const writeBytes = (path: string, bytes: Uint8Array) =>
  wrap(path, () => writeFile(path, bytes));
export const ensureDir = (path: string) => wrap(path, () => mkdir(path, { recursive: true }));
export const listDir = (path: string) => wrap(path, () => readdir(path));
export const exists = (path: string) =>
  Effect.tryPromise({ try: () => stat(path).then(() => true), catch: () => false }).pipe(
    Effect.catch(() => Effect.succeed(false)),
  );
export const readTextIfExists = (path: string) =>
  exists(path).pipe(Effect.flatMap((ok) => (ok ? readText(path) : Effect.succeed(undefined))));

export const pathJoin = join;
