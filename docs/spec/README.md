# Build-ready spec: index

Output of the wayfinder map [Wayfinder map: GraphRAG-powered 3D portfolio resume](https://github.com/PavelHolman/GraphRAG/issues/1). Read in this order; each document links the ticket that decided it. Vocabulary: `CONTEXT.md` at the repo root.

## Decisions (ADRs, `docs/adr/`)

1. [0001 Knowledge Graph taxonomy](../adr/0001-knowledge-graph-taxonomy.md): Node Types, Edge vocabulary, ids, time.
2. [0002 Monorepo package seams](../adr/0002-monorepo-package-seams.md): `schema`, `graph-index`, `retrieval`, `web`; the committed artifact as the contract.
3. [0003 Turn wire format](../adr/0003-turn-wire-format.md): NDJSON events, two-phase Subgraph, inline Citations.
4. [0004 Retrieval pipeline](../adr/0004-retrieval-pipeline.md): heuristic mode, vector seeds, weighted expansion, one LLM call.
5. [0005 No throw, no Date](../adr/0005-no-throw-no-date.md): the two lint bans and their single exception.
6. [0006 Cloudflare Workers deploy](../adr/0006-cloudflare-workers-deploy.md): Workers with static assets, bindings, secrets.

## Specs (`docs/spec/`)

| Spec | Covers |
|---|---|
| [tooling.md](tooling.md) | oxlint/oxfmt configs, tsconfig, Temporal polyfill, hooks, commitlint |
| [scene.md](scene.md) | force layout, answer-time shift, highlight tiers, constellation renderer, palette, mobile |
| [chat.md](chat.md) | centred field and caption, ghost hints and their Scene preview, citations, stream handling |
| [page.md](page.md) | Hero plus Sections from the artifact, header, CV and hero image generation, JSON-LD |
| [authoring.md](authoring.md) | content commands, committed artifact and embedding cache, CI verification |
| [evals.md](evals.md) | retrieval and answer tiers, case format, commands, committed results |
| [hardening.md](hardening.md) | input limits, rate limits, neuron budget and model degradation, abuse logging |
| [observability.md](observability.md) | OpenTelemetry event model, trace shape, browser events, privacy rule |
| [observability-backend.md](observability-backend.md) | OpenObserve target, Grafana Cloud stopgap, endpoint values, VPS runbook |
| [ci.md](ci.md) | the workflow file, gates, secrets |

## Research (branches `research/*`, `docs/research/*.md`)

effect-ai-rc4, embedding-model, graphrag-retrieval, oxlint-rules, observability-analytics, threlte-mobile, temporal-support, free-llm, self-hosted-observability. Prototype with every variant: branch `prototype/scene`.

## Still open on the map

- [Task: provision the observability VPS with OpenObserve](https://github.com/PavelHolman/GraphRAG/issues/27): human task, gates nothing.
- [Research: free capacity pool and zero-cost fallbacks](https://github.com/PavelHolman/GraphRAG/issues/26): deferred until the owner asks.

## Suggested first implementation ticket

The walking skeleton: monorepo scaffold per ADR 0002 and the tooling spec, three content Nodes, `content:index` producing the artifact, `turn()` streaming one real Turn through the wire format, the Ember Scene highlighting it, deployed to Workers with the CI workflow. Everything after that is filling in specs.
