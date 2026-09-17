// The app's TypeScript program is typed for the Cloudflare Worker, so the Bun and Node globals are
// deliberately out of scope: `Bun.file` or `process.cwd()` in `src/` must stay a compile error.
// These are the only `bun:test` exports the app's unit tests use; Bun provides them at run time.
declare module 'bun:test' {
  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(expected: unknown): void;
    toThrow(): void;
  }
  export const describe: (name: string, body: () => void) => void;
  export const test: (name: string, body: () => void | Promise<void>) => void;
  export const expect: (actual: unknown) => Matchers;
}
