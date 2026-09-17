---
status: accepted
---

# Retrieval pipeline: heuristic mode, vector seeds, weighted expansion, one LLM call

Every surveyed GraphRAG system's local search has the same shape, and a hand-authored graph of hundreds of Nodes needs nothing more. Retrieval is one deep operation, `turn(prompt, previousUsedIds?, history?) → Stream<TurnPart>`, that classifies the Prompt with heuristics, seeds by vector similarity, expands over weighted Edges, budgets the context, and makes exactly one streamed LLM call. The candidate Subgraph is emitted before the LLM call and the used Subgraph is the set of validated Citations (ADR 0003).

## Stages

1. **Classify** (no LLM). Fuzzy title or alias match with a high score → `entity`. Else more than ~80 words, or three or more line breaks or bullet markers → `match`. Else `hybrid`. Misclassification is cheap: modes differ only in seeding.
2. **Seed.**
   - `entity`: the matched Node; if the match is a Node Type name, every Node of that type.
   - `match`: split the job description into requirement lines; embed each (truncated to the 512-token cap, safe for a single requirement); top-k Nodes per line restricted to Skill, Experience, Education; union.
   - `hybrid`: top-k Node cosine plus top-k Edge cosine over the Prompt.
   - Always: `previousUsedIds` join as extra seeds at reduced weight. If no seed clears a threshold, fall back to the Person Node plus the top-degree Nodes; Retrieval never refuses by itself.
3. **Expand.** Two hops for `match`, one otherwise. Edge weights are constants in Retrieval, never authored: `uses`, `led`, `delivered` 1.0; `at`, `taught`, `in-domain` 0.7; `part-of` 0.5; `related-to` 0.3. Second-hop Nodes enter at half their Edge weight. Rank by accumulated seed similarity times Edge weight.
4. **Budget.** Cap the candidate Subgraph at 40 Nodes and 80 Edges. Context of roughly 6k tokens: seeds' full bodies, neighbours' title plus summary, Edges as their id plus note grouped by seed. The Person Node is always present at neighbour level.
5. **Emit** `turn-started` and `subgraph`.
6. **Generate.** One streamed call through the `LanguageModel` service. The prompt template is a pure function of candidate Subgraph, mode, and history, snapshot-tested. System rules: answer only from the context, cite every factual claim with `[[id]]`, decline questions unrelated to the owner's professional history, never invent Nodes. `match` mode asks for a per-requirement Markdown table with a Citation per row.
7. **Parse.** Strip markers into ordered `citation` events, validated against the candidate Subgraph. Parse and strip a trailing fenced `followups` block into a `followups` event; if missing or malformed, emit none and never fail the Turn. `turn-finished` carries the validated used ids.

## Embedding

`@cf/baai/bge-base-en-v1.5` on Workers AI at both build and query time, mean pooling, L2-normalised, cosine, **no query instruction prepended** on either side. Vectors ship in the static artifact and are scanned brute-force in the function. Voyage `voyage-4-lite` is the fallback if the 512-token cap bites; switching means re-embedding the corpus, never mixing models between sides.

## Language model

The `LanguageModel` is a swappable Effect layer. The default model is decided by [Research: free LLM options for the Turn Answer through Effect AI](https://github.com/PavelHolman/GraphRAG/issues/20); Claude Sonnet 5 via `@effect/ai-anthropic` is the paid path and the reference for prompt-template snapshots until that research lands.

## Considered and rejected

- **LLM-based classification or keyword extraction.** Rejected: a second call per Turn for a signal that only changes seeding.
- **Chunk-and-max-pool for job descriptions.** Rejected in favour of requirement lines, which are the natural unit and give sharp seeds.
- **Hand-written community summaries.** Rejected for now: the Person bio plus top-degree seeding covers global questions. Revisit only if the eval set shows them failing.
- **Retrieval deciding relevance and short-circuiting.** Rejected: a low similarity score is not proof of an off-topic Prompt; the system prompt declines.
- **Tool calls for followups or used ids.** Rejected: used ids are the validated Citations; followups are three strings in a fenced block.
