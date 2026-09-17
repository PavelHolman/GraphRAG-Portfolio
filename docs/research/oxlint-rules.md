# oxlint / oxfmt: forbidding `Date` and `throw`, with Svelte support

Resolves GitHub issue #5. Researched 2026-09-17 against primary sources only (oxc.rs docs, oxc-project/oxc repo, npm dist-tags, Effect docs/source).

Versions targeted: **oxlint 1.83.0**, **oxfmt 0.68.0**, **oxlint-plugin-eslint 1.83.0** (all `latest` on npm, published 2026-09-14). Svelte companions, if ever needed: eslint-plugin-svelte 3.23.0, prettier-plugin-svelte 4.1.1.

## Summary

- Yes for `.ts` and for the `<script>` blocks of `.svelte`; no for Svelte template markup, which oxlint does not parse at all.
- `Date`: use native `no-restricted-globals` (flags bare `Date`, `new Date()`, `Date.now()`; skips type-only uses); `no-restricted-properties` is optional belt-and-braces for `Date.now`/`Date.parse`.
- `throw`: oxlint has no native `no-restricted-syntax`; use `oxlint-plugin-eslint` (alpha JS plugins) rule `eslint-js/no-restricted-syntax` with a `ThrowStatement` selector. Selectors can scope generator bodies (Effect.gen) separately if desired.
- oxfmt is in **beta** (0.x); it formats `.svelte` via a bundled prettier-plugin-svelte when `"svelte": true` is set and the `svelte` package is installed. No separate Prettier install needed.
- Template-level enforcement (`throw` inside `{@const}`/handler expressions) is not possible with oxlint today; only eslint-plugin-svelte + svelte-eslint-parser under ESLint can see it.

## Findings

### 1. Rule availability in oxlint

| Rule | Native in oxlint 1.83.0? | Evidence |
|---|---|---|
| `eslint/no-restricted-globals` | Yes (since v0.4.0, category restriction) | https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-restricted-globals.html |
| `eslint/no-restricted-properties` | Yes (since v1.63.0) | https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-restricted-properties.html |
| `eslint/no-restricted-imports` | Yes | https://oxc.rs/docs/guide/usage/linter/rules.html |
| `eslint/no-restricted-syntax` | **No**: no `no_restricted_syntax.rs` under `crates/oxc_linter/src/rules/eslint/` (listing checked 2026-09-17) and the docs page 404s | https://github.com/oxc-project/oxc/tree/main/crates/oxc_linter/src/rules/eslint ; https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-restricted-syntax.html (404) |
| `eslint/no-throw-literal`, `typescript/only-throw-error` | Yes (pedantic), but they restrict *what* is thrown, not `throw` itself | https://oxc.rs/docs/guide/usage/linter/rules.html |

Maintainers have not committed to a native `no-restricted-syntax`; the recommended route is a local JS plugin or `no-restricted-properties` (discussion #11649, still unanswered): https://github.com/oxc-project/oxc/discussions/11649

`no-restricted-globals` config forms (from source): plain strings, `{ name, message }` objects, and a `{ globals, checkGlobalObject, globalObjects }` object. Matches are made on unresolved references; references with a local binding or type-only usage are skipped, so `let d: Date` in a type position is not flagged while `new Date()`, `Date.now()`, and `Date` as a value are: https://github.com/oxc-project/oxc/blob/main/crates/oxc_linter/src/rules/eslint/no_restricted_globals.rs

`no-restricted-properties` accepts `{ object, property, message, allowObjects, allowProperties }`; an entry with only `object` restricts every property on it, so `{ "object": "Date" }` flags `Date.now()` and `Date.parse()`: https://github.com/oxc-project/oxc/blob/main/crates/oxc_linter/src/rules/eslint/no_restricted_properties.rs

### 2. JS plugins / ESLint-compatible rules

- JS plugins are **alpha**: "JS plugins are currently in alpha, and remain under active development. All APIs should behave identically to ESLint." Supported: AST traversal, fixes, options, **selectors (esquery)**, `sourceCode` APIs, scope analysis, disable directives, LSP. Not supported: "Custom file formats and parsers (e.g. Svelte, Vue, Angular)" and type-aware rules. https://oxc.rs/docs/guide/usage/linter/js-plugins.html
- Config key is `jsPlugins` (array of specifiers or `{ name, specifier }` aliases). Same page.
- Alpha announcement (2026-03-11) introduces `oxlint-plugin-eslint`, "all ESLint's built-in rules" as a JS plugin, and uses `no-restricted-syntax` with a `ThrowStatement` selector as its worked example: https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html
- Package README: rules are prefixed `eslint-js/`; example config uses `"jsPlugins": [{ "name": "eslint-js", "specifier": "oxlint-plugin-eslint" }]`. Published in lockstep with oxlint (1.83.0 on 2026-09-14): https://github.com/oxc-project/oxc/tree/main/npm/oxlint-plugin-eslint and `npm view oxlint-plugin-eslint`.
- ESLint-compatible custom parsers (`languageOptions.parser`) exist only as a **draft PR** (#24262, 2026-07-07) aimed at Ember `.gjs/.gts`, explicitly not Svelte: https://github.com/oxc-project/oxc/pull/24262

### 3. Does oxlint parse `.svelte`?

- Docs: oxlint lints "Framework files (`.vue`, `.svelte`, `.astro`) by linting only their `<script>` blocks": https://oxc.rs/docs/guide/usage/linter.html
- Loader source: extracts at most one `<script>` plus one `<script module>` / `<script context="module">`, detects `lang="ts"`, and ignores markup entirely: https://github.com/oxc-project/oxc/blob/main/crates/oxc_linter/src/loader/partial_loader/svelte.rs
- JS plugins run on the extracted script ranges only; issue #20465 (open, 2026-03-17): "JS plugins can only report locations inside the extracted script program": https://github.com/oxc-project/oxc/issues/20465
- Known gap: `no-unused-vars` misfires in Svelte files because template references are invisible (#17991): https://github.com/oxc-project/oxc/issues/17991
- Full Svelte-aware linting is an RFC ("Embedded Framework Support / Language Plugins", April 2026); implementation deferred past Q3 2026: https://github.com/oxc-project/oxc/discussions/21936
- There is no `svelte` rules directory in oxlint (only `vue`): https://github.com/oxc-project/oxc/tree/main/crates/oxc_linter/src/rules
- eslint-plugin-svelte requires `svelte-eslint-parser` and ESLint >= 8.57.1 / 9; with TS it needs `parserOptions.parser: ts.parser` and `extraFileExtensions: ['.svelte']`. Because oxlint JS plugins cannot load custom parsers, eslint-plugin-svelte cannot run inside oxlint; it must run under ESLint alongside: https://github.com/sveltejs/eslint-plugin-svelte/blob/main/README.md ; https://sveltejs.github.io/eslint-plugin-svelte/user-guide/

### 4. oxfmt and `.svelte`

- Release state: **beta** since 2026-02-24 (alpha 2025-12-01); current `latest` is 0.68.0, released with oxlint 1.83.0 on 2026-09-14 (GitHub release `apps_v1.83.0`): https://oxc.rs/blog/2026-02-24-oxfmt-beta.html ; https://oxc.rs/blog/2025-12-01-oxfmt-alpha.html ; https://github.com/oxc-project/oxc/releases/tag/apps_v1.83.0
- Prettier compatibility: "Oxfmt matches Prettier's JavaScript formatting ... any formatting differences are considered bugs": https://oxc.rs/docs/guide/usage/formatter.html
- Language support: JS/TS/JSON/CSS/GraphQL/TOML/YAML are native Rust; HTML, Vue, **Svelte**, Markdown, MDX, Handlebars are "Prettier-backed" (Node round-trip inside the npm package). "Except `.svelte`, which additionally requires the `svelte` package to be installed and the `svelte` option to be enabled.": https://oxc.rs/docs/guide/usage/formatter/language-support.html
- Config reference: `svelte: object | boolean` (default disabled), sub-options `allowShorthand` (true), `indentScriptAndStyle` (true), `sortOrder` ("options-scripts-markup-styles"); "prettier-plugin-svelte requires the svelte package (svelte/compiler) at runtime, but Oxfmt does NOT bundle or auto-install it.": https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html
- Landed as "Experimental .svelte support (#21700)" in oxfmt 0.49.0 (2026-05-11); the changelog has not since dropped the "experimental" label: https://github.com/oxc-project/oxc/pull/21700 ; https://github.com/oxc-project/oxc/blob/main/apps/oxfmt/CHANGELOG.md ; plan in https://github.com/oxc-project/oxc/issues/19715
- Consequence: you do **not** install `prettier` or `prettier-plugin-svelte`; oxfmt bundles the plugin and only needs `svelte` (already a SvelteKit dependency).

### 5. Distinguishing `throw` in Svelte templates vs Effect generators

- Svelte templates: oxlint never sees markup, so a `throw` in `{@const}`, `{#snippet}`, or inline handler code is neither flagged nor distinguishable. Only ESLint + svelte-eslint-parser produces template AST nodes.
- Effect generators: esquery selectors can scope by ancestor, e.g. `:function[generator=true] ThrowStatement` (inside any generator) vs `:not(:function[generator=true]) ThrowStatement`. Selectors are a supported JS-plugin API: https://oxc.rs/docs/guide/usage/linter/js-plugins.html ; syntax reference https://eslint.org/docs/latest/extend/selectors
- Semantics justify banning `throw` inside `Effect.gen` too: the fiber runtime's `runLoop` converts any thrown value into a defect via `core.die(e)` (Effect 3.22.2 source), and the docs state a throwing thunk "will be treated as a defect": https://github.com/Effect-TS/effect/blob/effect%403.22.2/packages/effect/src/internal/fiberRuntime.ts ; https://effect.website/docs/getting-started/creating-effects/ . The recommended signal is `yield* Effect.fail(...)`: https://effect.website/docs/getting-started/using-generators/ . So a single "no throw anywhere" rule is the right default; the generator-scoped selector is available if a softer, Effect-specific message is wanted there.

## Recommendation

Use oxlint natively for `Date`, oxlint + `oxlint-plugin-eslint` for `throw`, and oxfmt with `svelte` enabled for formatting. Accept that Svelte *markup* is unlinted; if that matters, add ESLint + eslint-plugin-svelte for `.svelte` only (see Open questions).

Install:

```sh
npm i -D oxlint@1.83.0 oxfmt@0.68.0 oxlint-plugin-eslint@1.83.0
```

`.oxlintrc.json` (oxlint 1.83.0):

```jsonc
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "jsPlugins": [{ "name": "eslint-js", "specifier": "oxlint-plugin-eslint" }],
  "rules": {
    // Date: native rule. Flags `Date`, `new Date()`, `Date.now()`; type-only uses are skipped.
    "no-restricted-globals": [
      "error",
      { "name": "Date", "message": "Use the Clock service / injected `now` instead of Date." }
    ],
    // Belt-and-braces for Date.now() / Date.parse().
    "no-restricted-properties": [
      "error",
      { "object": "Date", "message": "Use the Clock service instead of Date.*" }
    ],
    // throw: not native; ESLint's rule via the JS plugin (alpha).
    "eslint-js/no-restricted-syntax": [
      "error",
      {
        "selector": ":function[generator=true] ThrowStatement",
        "message": "`throw` inside Effect.gen becomes a defect (die). Use `yield* Effect.fail(...)`."
      },
      {
        "selector": ":not(:function[generator=true]) ThrowStatement",
        "message": "Do not throw. Return an Effect failure (Effect.fail) or Effect.die for defects."
      }
    ]
  },
  "ignorePatterns": [".svelte-kit/**", "build/**", "node_modules/**"]
}
```

Notes: the two `ThrowStatement` selectors together cover every `throw`; collapse them to a single `{ "selector": "ThrowStatement", ... }` entry if separate messages are not wanted. To also catch `globalThis.Date` / `window.Date`, use the object form `{ "globals": [{ "name": "Date", "message": "..." }], "checkGlobalObject": true }`. All of these rules apply automatically to the `<script>` and `<script module>` blocks of `.svelte` files.

`.oxfmtrc.json` (oxfmt 0.68.0):

```jsonc
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "printWidth": 100,
  "singleQuote": true,
  // Enables the bundled prettier-plugin-svelte; needs the `svelte` package (already present in SvelteKit).
  "svelte": {
    "allowShorthand": true,
    "indentScriptAndStyle": true,
    "sortOrder": "options-scripts-markup-styles"
  },
  "ignorePatterns": [".svelte-kit/", "build/"]
}
```

`package.json` scripts:

```json
{
  "scripts": {
    "lint": "oxlint",
    "format": "oxfmt",
    "format:check": "oxfmt --check"
  }
}
```

Do not add `prettier` / `prettier-plugin-svelte`; oxfmt covers `.svelte` itself.

## Open questions

1. Template-level `throw` and `Date` in Svelte markup (`{@const}`, `{#snippet}`, `onclick={() => ...}`) are invisible to oxlint. If enforcement there is required, run ESLint with `eslint-plugin-svelte` + `svelte-eslint-parser` scoped to `**/*.svelte` with the same `no-restricted-globals` / `no-restricted-syntax` rules, and use `eslint-plugin-oxlint` to turn off overlapping rules. Decide whether that second toolchain is worth it before oxc's language-plugin RFC ships (no date; deferred past Q3 2026).
2. JS plugins are alpha; oxlint's "should behave identically to ESLint" claim means selector semantics are expected to match, but the `:function[generator=true]` scoping should be smoke-tested against an Effect.gen sample in this repo before relying on it.
3. oxfmt's Svelte path is Prettier-backed (Node round-trip) and still labelled "experimental" in the changelog; monitor https://github.com/oxc-project/oxc/issues/19715 for the native port. Pin exact versions and bump oxlint/oxfmt/oxlint-plugin-eslint together since they release in lockstep.
4. `no-restricted-globals` skips type-only references, so `Date` as a type annotation stays allowed. Confirm that is the intended policy.
