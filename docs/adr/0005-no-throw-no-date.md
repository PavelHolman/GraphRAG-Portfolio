---
status: accepted
---

# No `throw`, no `Date`, adapters are the only exception

Effect owns error handling and time in this codebase, so a `throw` becomes an untyped defect and a `Date` bypasses `Temporal` and the `Clock` service. We enforce both bans with oxlint (ADR-level rule; exact config in [docs/spec/tooling.md](../spec/tooling.md)):

- **No `throw` anywhere.** Inside `Effect.gen`, use `yield* Effect.fail(...)`; elsewhere return an Effect failure or `Effect.die` for defects. Two lint selectors give the two messages.
- **No `Date` value anywhere.** Use `Temporal` for calendar time and the `Clock` service for "now". The lint skips type-only positions.
- **The one exception is adapter files**, named `*.adapter.ts`, where a third-party library hands back a `Date` or throws. Convert at the edge (`Temporal.Instant.fromEpochMilliseconds`, `Effect.try`) with an inline disable and a comment. Nowhere else may disable these rules.
- **Svelte markup carries no logic.** oxlint cannot see markup expressions, so handlers call script-block functions and `{@const}` only destructures. This convention replaces a second lint toolchain for `*.svelte`, revisited when oxc ships language plugins.

Rejected: ESLint with the Svelte parser scoped to `*.svelte` (a second toolchain to catch a convention violation); banning the `Date` type as well (no value means no need for the type); allowing `throw` in non-Effect utility code (there is no non-Effect code by design).
