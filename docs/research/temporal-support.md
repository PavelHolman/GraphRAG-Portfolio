# Temporal API support: Bun 1.4, Cloudflare Workers, browsers

Resolves GitHub issue #8. Researched 2026-09-17 against primary sources; local measurements noted where made.

## Summary

- Bun 1.4.0+ ships `Temporal` natively, on by default (JSC implementation, enabled by oven-sh/bun#32978, merged 2026-08-05); `BUN_JSC_useTemporal=0` disables it. Bun 1.3.x has it off by default.
- Cloudflare Workers: **not available** as of 2026-09-17. No compatibility flag exists; a July 2026 production rollout was reverted after `Temporal.Now` returned epoch 0 (cloudflare/workerd#6907). Cloudflare says it will ship it but gives no timeline.
- Browsers: Chrome/Edge 144+, Firefox 139+ yes; Safari 27.0 (macOS and iOS, released 2026-09-14) **no**. Safari has it only in Technology Preview 249+ (2026-07-29). Not Baseline.
- Polyfill: use `temporal-polyfill` (v1.0.5, ~19.7 kB min+gzip measured, near-perfect test262 conformance, spec date Sept 2026). `@js-temporal/polyfill` is 0.5.1 (March 2025), 46.9 kB gzip, self-described pre-production, does not install a global.
- Types: TypeScript 6.0+ ships `esnext.temporal` (included in `lib: ["esnext"]`); `temporal-spec` covers TS < 6.0. Load the polyfill once via `import 'temporal-polyfill/global'` in the Worker entry and in SvelteKit's `src/hooks.client.ts`; Bun needs nothing.

## Findings

### Support matrix (2026-09-17)

| Runtime / browser | Native Temporal | Version / date | Source |
|---|---|---|---|
| Bun 1.4.0, 1.4.1, 1.4.2 | Yes, default on | 1.4.0 released 2026-08-20; enabled by PR #32978 merged 2026-08-05 | [bun.sh/blog/bun-v1.4](https://bun.sh/blog/bun-v1.4), [oven-sh/bun#32978](https://github.com/oven-sh/bun/pull/32978), [oven-sh/bun#15853](https://github.com/oven-sh/bun/issues/15853); verified locally: `bun@1.4.0` and `bun@1.4.2` print `typeof Temporal === "object"`, `BUN_JSC_useTemporal=0` gives `undefined` |
| Bun 1.3.x | No (opt-in) | `BUN_JSC_useTemporal=1` enables it (verified locally on 1.3.14) | [oven-sh/bun#15853](https://github.com/oven-sh/bun/issues/15853) comment 2026-08-05 |
| JavaScriptCore upstream | Yes, default on | WebKit bug 318885 "[JSC] Enable Temporal object by default", RESOLVED FIXED 2026-07-08, commit 316742@main | [bugs.webkit.org/318885](https://bugs.webkit.org/show_bug.cgi?id=318885), [WebKit/WebKit#68930](https://github.com/WebKit/WebKit/pull/68930), tracking bug [223166](https://bugs.webkit.org/show_bug.cgi?id=223166) |
| Cloudflare Workers (workerd) | **No** | V8 15.3 as of 2026-08-28 (engine has Temporal, but workerd does not expose it); no compat flag | [Workers changelog](https://developers.cloudflare.com/workers/platform/changelog/), [compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/), [workerd#6907](https://github.com/cloudflare/workerd/issues/6907), [workerd discussion #6716](https://github.com/cloudflare/workerd/discussions/6716) |
| Node.js | Yes, default on | 26.0.0 (V8 14.6) | [nodejs.org v26.0.0](https://nodejs.org/en/blog/release/v26.0.0) |
| Deno | Yes | 2.7 | [MDN BCD Temporal.json](https://raw.githubusercontent.com/mdn/browser-compat-data/main/javascript/builtins/Temporal.json) |
| Chrome / Chrome Android | Yes | 144 (2026-01-13) | [MDN BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/javascript/builtins/Temporal.json), [caniuse](https://caniuse.com/temporal), [web-features](https://web-platform-dx.github.io/web-features-explorer/features/temporal/) |
| Edge | Yes | 144 (2026-01-21) | same |
| Firefox / Firefox Android | Yes | 139 (2025-05-27); 135-138 behind a pref | same |
| Opera | Yes | 131 | [caniuse](https://caniuse.com/temporal) |
| Safari macOS | **No** | Safari 27.0 (2026-09-14) release notes list BigInt Math and `import defer`, no Temporal; STP 249 (2026-07-29) "Added support for the `Temporal` object" | [Safari 27 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes), [STP 249](https://webkit.org/blog/18182/release-notes-for-safari-technology-preview-249/), [STP 251](https://webkit.org/blog/18194/release-notes-for-safari-technology-preview-251/) |
| Safari iOS | **No** | through 27.0; BCD `safari_ios: false` | [MDN BCD](https://raw.githubusercontent.com/mdn/browser-compat-data/main/javascript/builtins/Temporal.json), [caniuse](https://caniuse.com/temporal) |
| Samsung Internet | No | through v30 | [caniuse](https://caniuse.com/temporal) |
| Baseline | Limited availability | "blocked since January 2026 by Safari" | [web-features explorer](https://web-platform-dx.github.io/web-features-explorer/features/temporal/), [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) |

Proposal status: Stage 4; the README says it "will be merged into the ECMA-262 and ECMA-402 standards" ([tc39/proposal-temporal](https://github.com/tc39/proposal-temporal)).

### Bun 1.4 detail

- Bun 1.4 release notes do not mention Temporal, but say the WebKit pin was bumped 39 times pulling in "roughly eight months of upstream JavaScriptCore work" ([bun.sh/blog/bun-v1.4](https://bun.sh/blog/bun-v1.4)). Bun does not publish a JSC version number; `process.versions.webkit` on 1.4.2 is commit `2e2aa2290fac856d6f451ceacb58f7f5b44dd057`.
- PR #32978 sets `JSC::Options::useTemporal() = true` and reports test262 (`temporal-test262-runner` 0.4.0, test262 `de8e621c`): `built-ins/Temporal` 100% (4603 tests) vs Node 26.3 98.7%; `intl402/Temporal` (non-ISO calendars) 56.2% vs Node 38.3%. Known gaps are all non-ISO-calendar (e.g. `dayOfYear` ignores calendar; buddhist `year` is ISO year) ([oven-sh/bun#32978](https://github.com/oven-sh/bun/pull/32978)).
- The PR states "TypeScript 6.0 ships the type declarations and its `lib.esnext.d.ts` references `esnext.temporal`, so nothing is needed in `bun-types`."

### Cloudflare Workers detail

- Workers docs claim "all of the standard built-in objects supported by the current Google Chrome stable release are supported" ([web standards](https://developers.cloudflare.com/workers/runtime-apis/web-standards/)), but Temporal is an exception: workerd does not enable V8's implementation. A maintainer confirmed on 2026-08-04: "We do plan to enable native Temporal, but I don't have a timeline for when" ([workerd#6907](https://github.com/cloudflare/workerd/issues/6907)).
- The July 2026 incident matters for the loading strategy: a native `Temporal` appeared in production with `Temporal.Now.instant()` stuck at epoch 0 while `Date.now()` was correct; guards of the form `typeof Temporal === 'undefined'` silently disabled the polyfill. Workaround used in that thread: `import { Temporal } from 'temporal-polyfill/implementation'` (forced non-native) ([workerd#6907](https://github.com/cloudflare/workerd/issues/6907)).
- No `temporal` flag exists in `src/workerd/io/compatibility-date.capnp` (grep on 2026-09-17) and none is listed in the compatibility-flags docs.

### Polyfill comparison

| | `temporal-polyfill` | `@js-temporal/polyfill` |
|---|---|---|
| Version / last publish | 1.0.5 / 2026-09-11 | 0.5.1 / 2025-03-31 |
| License | MIT | ISC |
| Min+gzip (measured with esbuild `--bundle --minify`, gzip -9) | `/global` 20.0 kB; `.` 19.3 kB; `/implementation` 19.2 kB (brotli 17.8 kB) | 45.8 kB (brotli 39.7 kB) |
| Size claimed by author | "Only 19.5 kB" (19.4 kB, 23.3 kB for `/full`) | none stated |
| Spec conformance | "near-perfect [with just 2 intentional deviations]" vs test262; spec date September 2026 | tracks spec as of March 2025; README: "The goal is to be ready for production use when the Temporal proposal reaches Stage 4"; roadmap item "Release production version to NPM" unchecked |
| Installs global | Yes via `/global` (uses native if present) or `/shim` `install()`; `/implementation` forces polyfill | No: "this polyfill currently does not install a global `Temporal` object" |
| Deps | `temporal-spec`, `temporal-utils` | `jsbi` (BigInt emulation) |
| Types | `index.d.ts` re-exports `temporal-spec`; `/types/global` for TS < 6 | bundled `index.d.ts` (namespace import only) |
| Calendars | default build: `iso8601`, `gregory`; `/full` adds 14 more | all |
| Min environments | Chrome 67, Firefox 68, Safari 14 / iOS 14, Edge 79, Node 16 | ES2020 output |

Sources: [fullcalendar/temporal-polyfill README](https://github.com/fullcalendar/temporal-polyfill), [polyfill/README.md](https://github.com/fullcalendar/temporal-polyfill/blob/main/polyfill/README.md), [npm temporal-polyfill](https://www.npmjs.com/package/temporal-polyfill), [js-temporal/temporal-polyfill README](https://github.com/js-temporal/temporal-polyfill), [npm @js-temporal/polyfill](https://www.npmjs.com/package/@js-temporal/polyfill), [tc39/proposal-temporal polyfill table](https://github.com/tc39/proposal-temporal#polyfills) (lists `@js-temporal/polyfill` as Alpha, `temporal-polyfill` as Stable). Size figures are from a local build in this session (`npm view` gave unpacked sizes 1.03 MB and 2.98 MB respectively).

### TypeScript types

- TypeScript 6.0 (current: 7.0.2) includes Temporal types "via `--target esnext` or `"lib": ["esnext"]` (or the more-granular `esnext.temporal`)" ([TS 6.0 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/), [src/lib/esnext.temporal.d.ts](https://github.com/microsoft/TypeScript/blob/main/src/lib/esnext.temporal.d.ts)).
- `temporal-polyfill/global` docs: with TS >= 6.0 add `"lib": ["esnext"]` or `["esnext.temporal", "esnext.intl", "esnext.date"]`; with TS < 6.0 add `import 'temporal-polyfill/types/global'` next to the global import ([polyfill README, Global TypeScript Types](https://github.com/fullcalendar/temporal-polyfill/blob/main/polyfill/README.md)).
- `temporal-spec` 1.0.1 is the standalone `.d.ts`, "Most useful on TypeScript < 6.0" ([README](https://github.com/fullcalendar/temporal-polyfill#temporal-spec)).
- `@js-temporal/polyfill` types are only reachable through `import { Temporal } from '@js-temporal/polyfill'`; they do not augment the global.

### Loading once per runtime

| Runtime | Action | Why |
|---|---|---|
| Bun server entry | Nothing (Bun >= 1.4.0). Optionally `import 'temporal-polyfill/global'` as a no-op safety net: `install()` is `NativeTemporal || installImplementation()` so it defers to native. | native, verified |
| Cloudflare Worker entry | First line of the Worker entry module: `import 'temporal-polyfill/global'`. Module top-level runs once per isolate. Consider `import { installImplementation } from 'temporal-polyfill/shim'; installImplementation()` (forced) until Cloudflare ships a tested native, given the epoch-0 incident. | not native; native-detection guard was the failure mode in workerd#6907 |
| SvelteKit browser | `import 'temporal-polyfill/global'` at the top of `src/hooks.client.ts` (runs once "when the app starts in the browser") ([SvelteKit hooks](https://svelte.dev/docs/kit/hooks)). SSR side: `src/hooks.server.ts` if the server adapter is Workers; omit for Bun. | Safari 27 desktop + iOS lack it |
| CDN alternative | `<script src="https://cdn.jsdelivr.net/npm/temporal-polyfill@1.0.5/global.min.js">` in `app.html` before hydration | polyfill README |

## Recommendation

1. Treat Temporal as native on Bun >= 1.4.0 and in Chrome/Edge 144+, Firefox 139+; treat it as absent on Cloudflare Workers and all Safari (27.0 desktop and iOS). Pin Bun >= 1.4.0 in `package.json`/`.bun-version`.
2. Use `temporal-polyfill` 1.0.x (not `@js-temporal/polyfill`, which is pre-1.0, 2.4x larger, and 18 months behind spec). Load it once: Worker entry module top line, and `src/hooks.client.ts` in SvelteKit. On Workers prefer the forced `installImplementation()` path until Cloudflare re-ships native Temporal, then switch to `/global`.
3. TypeScript: set `"lib": ["esnext"]` (TS >= 6.0). Do not rely on `@js-temporal/polyfill` types.
4. Re-check Safari 27.x point releases and the Workers changelog quarterly; STP 249 shipped Temporal so Safari 27.x or 28 is the likely first stable.

## Open questions

- When will Cloudflare re-enable native Temporal, and will it be gated by a compatibility flag or date? No tracking issue exists beyond workerd#6907 / discussion #6716.
- Which Safari stable version will carry STP 249's Temporal? Safari 27.0 release notes omit it; no Apple statement found.
- Do we need non-ISO calendars? If so, use `temporal-polyfill/full` (+4 kB) and note Bun's JSC scores 56% on `intl402/Temporal`.
- Bun's exact JSC version is not published; only the WebKit commit hash in `process.versions.webkit`.
