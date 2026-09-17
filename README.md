# GraphRAG portfolio

An interactive 3D resume: a visitor asks a question, retrieval selects the Subgraph of the owner's professional history that answers it, one streamed LLM call answers with inline citations, and the Scene highlights the cited Nodes as they arrive.

- Vocabulary: `CONTEXT.md`. Decisions: `docs/adr/`. Specs: `docs/spec/README.md`.
- Content: `content/<type>/<slug>.md` (see `docs/spec/authoring.md`).

## Commands

```sh
bun install
bun content:check              # validate the Knowledge Graph
bun content:index              # rebuild the committed artifact (needs WORKERS_AI_TOKEN + CLOUDFLARE_ACCOUNT_ID for real embeddings)
bun content:ask "a question"   # what retrieval would select, no LLM
bun dev                        # SvelteKit dev server against the committed artifact
bun test                       # unit tests (packages/)
bun eval                       # retrieval-tier evals
bun lint && bun format:check && bun typecheck
```

Without Cloudflare credentials the app runs fully offline: the local hashing embedder and a scripted LanguageModel stand in for Workers AI, and the page shows a notice. Copy `.env.example` to `.env` to use the real services.

## Layout

```
apps/web               SvelteKit on Cloudflare Workers: /api/turn, chat, Scene, Sections
packages/schema        Effect Schemas: Nodes, Edges, artifact, Turn wire
packages/graph-index   content → validated, embedded, laid-out artifact (generated/, committed)
packages/retrieval     turn(): classify, seed, expand, budget, one LLM call, citations
content/               the Knowledge Graph source
evals/                 eval cases and committed results
```
