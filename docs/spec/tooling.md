# Tooling spec

Verbatim configuration for the first implementation ticket. Versions are exact for the oxc trio because they release in lockstep; bump all three together. Rationale for the bans: [ADR 0005](../adr/0005-no-throw-no-date.md). Package layout: [ADR 0002](../adr/0002-monorepo-package-seams.md).

## Runtime

- `.bun-version`: `1.4.0` (Temporal is native from 1.4.0).
- Root `package.json` `"workspaces": ["apps/*", "packages/*"]`, `"packageManager": "bun@1.4.0"`.

## Dependencies (root, dev)

```sh
bun add -d oxlint@1.83.0 oxfmt@0.68.0 oxlint-plugin-eslint@1.83.0 husky lint-staged @commitlint/cli @commitlint/config-conventional typescript@^6
```

Runtime: `temporal-polyfill@^1.0.5` in `apps/web` and `packages/retrieval`.

## File access

Build-time code reads and writes through Effect's `FileSystem` service, never `node:fs` directly:
the interface ships in `effect`, the implementation in `@effect/platform-node` (pinned to the same
version as `effect`), and the layer is provided once per entry point (`content:*` CLI, the eval
runner, the unit tests). Errors are the standard `PlatformError`. Path joining stays on `node:path`,
which is pure and needs no seam. The one exception is `apps/web`, which runs in the Worker: its
artifact loader reads through the `ASSETS` binding, with a dev-only dynamic import for disk reads.

## `.oxlintrc.json`

```jsonc
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "jsPlugins": [{ "name": "eslint-js", "specifier": "oxlint-plugin-eslint" }],
  "rules": {
    "no-restricted-globals": [
      "error",
      {
        "name": "Date",
        "message": "Use Temporal for calendar time and the Clock service for now(). See ADR 0005.",
      },
    ],
    "no-restricted-properties": [
      "error",
      { "object": "Date", "message": "Use the Clock service instead of Date.*. See ADR 0005." },
    ],
    "eslint-js/no-restricted-syntax": [
      "error",
      {
        "selector": ":function[generator=true] ThrowStatement",
        "message": "throw inside Effect.gen becomes a defect. Use yield* Effect.fail(...). See ADR 0005.",
      },
      {
        "selector": ":not(:function[generator=true]) ThrowStatement",
        "message": "Do not throw. Return Effect.fail(...) or Effect.die(...). See ADR 0005.",
      },
    ],
  },
  "ignorePatterns": [".svelte-kit/**", "build/**", "dist/**", "node_modules/**"],
}
```

Inline disables for these three rules are permitted only in files matching `*.adapter.ts`, each with a comment naming the library being wrapped. Svelte markup is not linted; it carries no logic by convention.

## `.oxfmtrc.json`

```jsonc
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "printWidth": 100,
  "singleQuote": true,
  "svelte": {
    "allowShorthand": true,
    "indentScriptAndStyle": true,
    "sortOrder": "options-scripts-markup-styles",
  },
  "ignorePatterns": [".svelte-kit/", "build/", "dist/"],
}
```

No Prettier; oxfmt formats `.svelte` via its bundled plugin.

## `tsconfig.base.json`

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "lib": ["esnext", "dom", "dom.iterable"],
    "target": "es2023",
    "module": "esnext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "plugins": [{ "name": "@effect/language-service" }],
  },
}
```

Each workspace's `tsconfig.json` extends it. `lib: esnext` supplies the Temporal types on TypeScript 6.

## Temporal polyfill

- `apps/web/src/hooks.client.ts`, first line: `import 'temporal-polyfill/global'`.
- Worker entry (server hooks or adapter entry), first line: `import { installImplementation } from 'temporal-polyfill/shim'; installImplementation()` (forced, because Cloudflare's native rollout was reverted).
- Bun scripts need nothing.

## Hooks

`.husky/pre-commit`: `bunx lint-staged`
`.husky/commit-msg`: `bunx commitlint --edit "$1"`
`.husky/pre-push`: `bun run typecheck`

`package.json`:

```json
{
  "scripts": {
    "lint": "oxlint",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "typecheck": "bun run --filter '*' typecheck",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,js,svelte}": ["oxlint", "oxfmt"],
    "*.{json,md,yaml}": ["oxfmt"]
  }
}
```

`commitlint.config.js`: `export default { extends: ['@commitlint/config-conventional'] }`. Scopes are free-form until the packages exist; then restrict to `web`, `schema`, `graph-index`, `retrieval`, `content`, `docs`, `tooling`.

## Open items carried by other tickets

- CI workflow shape: the CI and deploy pipeline fog on the map.
- Smoke-test the `:function[generator=true]` selector against an `Effect.gen` sample in the first implementation ticket; JS plugins are alpha.
