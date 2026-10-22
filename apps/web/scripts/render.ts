// `bun content:render [--verify]`: prints the `/print` route of a built app to `static/cv.pdf`
// with Playwright. With --verify it renders to memory and compares the extracted text with the
// committed PDF instead (bytes differ on every print). docs/spec/page.md.
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import { Data, Effect, FileSystem, Schedule } from 'effect';
import { chromium } from '@playwright/test';
import { extractText, getDocumentProxy } from 'unpdf';
import { join } from 'node:path';

const WEB = join(import.meta.dir, '..');
const CV = join(WEB, 'static', 'cv.pdf');
const PORT = 4175;
const ORIGIN = `http://localhost:${PORT}`;

class RenderError extends Data.TaggedError('RenderError')<{ step: string; cause?: unknown }> {}

const log = (line: string) => Effect.sync(() => console.log(line));
const err = (line: string) => Effect.sync(() => console.error(line));
const attempt = <A>(step: string, f: () => Promise<A>) =>
  Effect.tryPromise({ try: f, catch: (cause) => new RenderError({ step, cause }) });

/** `vite preview` of the last build, stopped when the scope closes. */
const preview = Effect.acquireRelease(
  Effect.sync(() =>
    Bun.spawn(['bunx', 'vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: WEB,
      env: { ...process.env, GRAPHRAG_FAKE_AI: '1' },
      stdout: 'ignore',
      stderr: 'inherit',
    }),
  ),
  (proc) => Effect.sync(() => proc.kill()),
).pipe(
  Effect.tap(() =>
    attempt('wait for vite preview', () =>
      fetch(`${ORIGIN}/print`).then((r) =>
        r.ok ? r : Promise.reject(new Error(`status ${r.status}`)),
      ),
    ).pipe(Effect.retry({ schedule: Schedule.spaced('250 millis'), times: 80 })),
  ),
);

const browser = Effect.acquireRelease(
  attempt('launch chromium', () => chromium.launch()),
  (b) => Effect.promise(() => b.close()),
);

const print = Effect.gen(function* () {
  yield* preview;
  const page = yield* Effect.flatMap(browser, (b) => attempt('open page', () => b.newPage()));
  yield* attempt('load /print', () => page.goto(`${ORIGIN}/print`, { waitUntil: 'networkidle' }));
  yield* attempt('fonts', () => page.evaluate(() => document.fonts.ready.then(() => undefined)));
  const pdf = yield* attempt('print', () =>
    page.pdf({ preferCSSPageSize: true, printBackground: true, tagged: true }),
  );
  return new Uint8Array(pdf);
}).pipe(Effect.scoped);

const textOf = (pdf: Uint8Array) =>
  attempt('extract text', async () => {
    // unpdf takes ownership of the buffer it is given.
    const doc = await getDocumentProxy(new Uint8Array(pdf));
    return extractText(doc, { mergePages: true });
  });

const main = Effect.gen(function* () {
  const verify = process.argv.includes('--verify');
  const fs = yield* FileSystem.FileSystem;
  const pdf = yield* print;
  const { totalPages, text } = yield* textOf(pdf);
  if (totalPages !== 1) {
    yield* err(`cv.pdf has ${totalPages} pages; the CV must fit one. Shorten the content.`);
    return 1;
  }
  if (!verify) {
    yield* fs.writeFile(CV, pdf);
    yield* log(`wrote ${CV} (${Math.round(pdf.length / 1024)} KiB)`);
    return 0;
  }
  if (!(yield* fs.exists(CV))) {
    yield* err(`${CV} is missing; run bun content:render and commit it.`);
    return 1;
  }
  const committed = yield* textOf(yield* fs.readFile(CV));
  if (committed.text !== text) {
    yield* err('cv.pdf is stale: its text differs from /print. Run bun content:render and commit.');
    return 1;
  }
  yield* log('ok: cv.pdf matches /print');
  return 0;
});

const code = await Effect.runPromise(
  main.pipe(
    Effect.provide(NodeFileSystem.layer),
    Effect.catchCause((cause) => err(`error: ${cause.toString()}`).pipe(Effect.as(1))),
  ),
);
process.exit(code);
