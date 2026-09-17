# Content authoring spec

Decisions from [Decide: content authoring workflow and validation feedback](https://github.com/PavelHolman/GraphRAG/issues/18). Taxonomy per ADR 0001, packages per ADR 0002 (amended: the artifact is committed), tooling per `docs/spec/tooling.md`.

## The loop

1. Edit or add a Markdown Node under `content/<type>/<slug>.md` (scaffold with `bun content:new <type> <slug>`).
2. Save. The pre-commit hook runs `content:check` on staged content files and refuses a commit with a broken Node.
3. Run `bun content:index` when you want the artifact regenerated (or let the pre-commit hook do it when content changed). Only Nodes and Edges whose embedded text changed hit the embedding API.
4. `bun dev` serves the app against the committed artifact; `bun content:ask "<prompt>"` shows what retrieval would select without calling the LLM.
5. Commit content, artifact and cache together. CI verifies they agree.

## Commands (repo root)

| Command                         | Does                                                                                                                                                                                                                   | Network                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `bun content:check`             | parse every Node, validate frontmatter against the Effect Schema per Node Type, dangling `to` refs, Edge types not allowed for the source type, orphan Nodes, Nodes hidden with no path from Person, duplicate aliases | none                                  |
| `bun content:index`             | format `content/` (so the committed text and the embedded text agree), `content:check`, then derive Skill spans, embed cache misses, compute the seeded force Layout, write the artifact and the JSON Schema           | Workers AI REST for cache misses only |
| `bun content:ask "<prompt>"`    | classify, seed, expand and budget against the local artifact; print mode, seeds, candidate Nodes and Edges with scores, and the rendered prompt template                                                               | Workers AI for the query embedding    |
| `bun content:new <type> <slug>` | write a Node file from the type's template with required fields as placeholders                                                                                                                                        | none                                  |
| `bun dev`                       | SvelteKit dev server against the committed artifact                                                                                                                                                                    | none                                  |

Error output names the file, the field, the offending value and the allowed values, one line per problem, non-zero exit.

## Where things live

- **Artifact**: `packages/graph-index/generated/` (committed): `graph.json` (Nodes, Edges, adjacency, derived spans, Layout), `node-embeddings.bin` and `edge-embeddings.bin` (Float32, little-endian, 768-d), `hints.json` (authored hints with their precomputed candidate ids), `content.schema.json`. `dist/` remains real build output and is gitignored.
- **Embedding cache**: `packages/graph-index/.cache/embeddings.json` (committed): `{ [id]: { hash, vector } }` where `hash` is SHA-256 of the exact text embedded (title plus body plus aliases for Nodes; the template sentence or note for Edges). A frontmatter-only change never re-embeds; a body edit re-embeds that Node and the Edges whose text includes its title.
- **Layout**: full seeded relayout on every index. No anchoring.

## CI verification

CI never needs an embedding credential. It runs `content:check`, then rebuilds the artifact with the embedding step reading the committed cache only (a miss fails the job with the list of ids that need `content:index` locally), and diffs the result against the committed artifact. Any difference fails the job.

## Editor

No editor integration is promised. The JSON Schema is emitted for anyone who wants it; `.zed/settings.json` carries file associations and format-on-save only. Feedback is the CLI and the pre-commit hook.

## Rejected

Gitignored artifact rebuilt in CI (needs credentials on every deploy, no reviewable diff, no offline dev); caching by file hash (re-embeds on frontmatter edits); anchored incremental layout (complexity for a diff nobody reads); editor-side frontmatter validation as a requirement.
