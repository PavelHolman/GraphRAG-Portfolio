---
status: accepted
---

# Monorepo package seams: schema, index, retrieval, web

The build-time indexer (Bun, filesystem, embedding API) and the runtime Retrieval (Cloudflare function, static artifact, LLM) run in different environments, and the browser must never receive server code. We split the Bun workspace into three packages and one app, with the **static graph artifact** as the contract between build time and runtime and a dependency-free schema package as the only thing everyone imports.

```
/
├── content/<type>/<slug>.md       ← the Knowledge Graph source; data, not code
├── apps/web                       ← SvelteKit: endpoint, chat panel, Scene (src/lib/scene)
├── packages/schema                ← Effect Schemas only: Node, Edge, artifact, Turn parts
├── packages/graph-index           ← build step: read content/, validate, derive spans, embed, layout → dist/ artifact
├── packages/retrieval             ← runtime: turn(prompt, previousSubgraph?) → Stream<TurnPart>
├── tsconfig.base.json, .oxlintrc.json   ← root config; workspaces extend
```

## Interfaces

- **`packages/schema`**: exports Effect Schemas and their types. No runtime dependencies beyond `effect`. Every other workspace depends on it; it depends on nothing in the repo.
- **`packages/graph-index`**: one operation, `index(contentDir) → Effect<Artifact>`, plus a `bun run index` entry that writes `dist/`. Requires `Embedder` and a filesystem. The artifact is gitignored; whether to commit it is decided by the authoring workflow ticket.
- **`packages/retrieval`**: one operation, `turn(prompt, previousSubgraph?) → Stream<TurnPart>`. Classification, seeding, one-hop expansion, budgeting, the LLM call, and id validation are internal seams used by its own tests. Requires exactly three services: `Embedder`, `LanguageModel`, `GraphArtifact`.
- **`apps/web`**: the `/api/turn` endpoint is a pass-through from HTTP to the retrieval Stream. The Scene lives at `src/lib/scene`, not in a package.

## Effect services that cross seams

| Service | Adapters |
|---|---|
| `Embedder` | Workers AI binding (runtime), Workers AI REST from Bun (build), fake (tests) |
| `LanguageModel` | Anthropic via Effect AI, recorded layer (tests) |
| `GraphArtifact` | disk (build, tests), static import from `graph-index/dist` (runtime) |
| `Clock` | Effect built-in, for derived Skill spans |

Rate limiting, tracing, and config are layers the app composes around retrieval; they are not part of retrieval's interface.

## Considered and rejected

- **Two packages (graph + retrieval).** Rejected: retrieval and the web app would drag the indexer's build-time dependencies into a Workers bundle.
- **Retrieval exposing `retrieve` and `answer` separately, or every stage.** Rejected: the endpoint would become an orchestrator that fails the deletion test. One deep operation gives the endpoint nothing to do but forward.
- **Turn protocol types inside retrieval behind a subpath export.** Rejected: relies on tree-shaking to keep LLM code out of the browser. They live in `packages/schema`.
- **`packages/scene`.** Rejected: one adapter is a hypothetical seam. Revisit if a second consumer appears.
- **`packages/config`.** Rejected: root-level config files extended by workspaces are one fewer package to explain.
- **Content inside `graph-index`.** Rejected: the person editing content should not need to know which package reads it, and a content-directory parameter is what makes the indexer testable with fixtures.
