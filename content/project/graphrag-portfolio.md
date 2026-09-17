---
title: GraphRAG Portfolio
summary: This site. A 3D resume that answers questions from a knowledge graph and highlights its evidence.
start: 2026-09
repo: https://github.com/PavelHolman/GraphRAG
uses:
  - {
      to: skill/effect,
      note: 'the retrieval pipeline is one Effect Stream of typed Turn events, with Embedder, LanguageModel and GraphArtifact as swappable services',
    }
  - {
      to: skill/typescript,
      note: 'a Bun workspace of strict TypeScript packages sharing one Effect Schema package',
    }
  - {
      to: skill/sveltekit,
      note: 'SvelteKit app with a streamed NDJSON endpoint and server-rendered resume sections',
    }
  - {
      to: skill/threejs,
      note: 'a Threlte scene draws the whole graph as one shader point cloud with a force layout that shifts toward each answer',
    }
  - {
      to: skill/cloudflare-workers,
      note: 'deployed as a Worker with static assets; embeddings and the LLM through Workers AI',
    }
  - {
      to: skill/retrieval-augmented-generation,
      note: 'two-phase subgraph highlighting driven by validated inline citations',
    }
  - {
      to: skill/agentic-engineering,
      note: 'built with Claude Code against written specs and ADRs, with lint rules and evals as guardrails',
    }
in-domain: [domain/developer-tooling]
---

Pavel's personal interactive 3D portfolio: a visitor asks a question or pastes a job description, retrieval selects a subgraph of his professional history, one streamed LLM call answers with inline citations, and the 3D scene highlights the cited nodes as they arrive. Hand-authored Markdown nodes with typed frontmatter are validated and embedded at build time into a committed artifact; the runtime is a stateless Cloudflare Worker. Lint rules forbid `throw` and `Date` in favour of Effect and Temporal.
