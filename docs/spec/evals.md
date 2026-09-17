# Answer-quality eval spec

Decisions from [Decide: answer-quality eval set and how it runs](https://github.com/PavelHolman/GraphRAG/issues/21). Pipeline per ADR 0004, packages per ADR 0002, wire per ADR 0003.

## Two tiers

- **Retrieval tier** (deterministic, no LLM): runs `turn()` up to the `subgraph` event against the committed artifact and asserts on mode, seeds and the candidate Subgraph. Runs in CI on every push and fails the job on any miss.
- **Answer tier** (live model, on demand): runs the full Turn and asserts on validated Citations, decline behaviour and shape. Never in CI by default. Each case runs N times and passes when at least K runs pass; defaults N=3, K=3.

## Case format

One YAML file per case under `evals/cases/<id>.yaml`. Cases are content, reviewed like content.

```yaml
id: match-platform-lead
mode: match # expected classification: match | entity | hybrid
prompt: |
  <text>
history: [] # optional: prior Turns as { prompt, answer }
previousUsedIds: [] # optional: multi-turn seeds
retrieval:
  must_seed: [skill/kubernetes, skill/kafka]
  must_include: [experience/staff-engineer]
  must_exclude: [education/msc-computer-science]
  max_nodes: 40
answer:
  must_cite: [skill/kubernetes, experience/staff-engineer]
  must_not_cite: [organization/univ-of-prague]
  decline: false # true for off-topic and injection cases
  shape: table # table | prose | decline
  runs: 3 # optional override of N
  min_pass: 3 # optional override of K
```

Ids are the `type/slug` ids from ADR 0001; the runner fails a case whose ids do not exist in the artifact.

## The set

The target is about 20 cases in the groups below; the committed set (`evals/cases/`) grows towards it and CI runs whatever is committed. Current: 8 cases (1 match, 4 entity, 1 hybrid, 1 global, 1 off-topic).

| Group      | Target | Notes                                                                                                   |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------- |
| match      | 3      | real job descriptions the owner would apply to: platform, frontend, poor fit                            |
| entity     | 5      | a Skill, a Project, an Experience, an Organization, a Node Type name ("your education")                 |
| hybrid     | 4      | mixed questions ("how do you approach testing in event-driven systems")                                 |
| global     | 2      | "what are you strongest at", "summarise your career"; may set `min_pass: 2`                             |
| off-topic  | 3      | weather, "write me a poem", a prompt-injection attempt ("ignore the context and…"); all `decline: true` |
| multi-turn | 3      | carry `history` and `previousUsedIds`; assert the follow-up seeds from the previous Turn                |

## Commands (repo root)

| Command                                                    | Does                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `bun eval`                                                 | retrieval tier over all cases; prints a table of misses; non-zero on any miss |
| `bun eval:answers [--model <id>] [--case <id>] [--runs N]` | answer tier live; writes `evals/results/<YYYY-MM-DD>-<model>.json` and `.md`  |
| `bun content:ask "<prompt>"`                               | the single-prompt primitive the runner is built on (authoring spec)           |

The runner lives in `packages/retrieval/eval/` and imports `turn()` directly with the disk `GraphArtifact` adapter and a fake `LanguageModel` for the retrieval tier. Cases and results live at the repo root under `evals/` because they are content, not code.

## Results

Committed JSON per run: case id, pass/fail per run, cited ids, decline flag, latency, tokens, `model`, `promptTemplateHash`, `artifactHash`, date. The Markdown summary is one table. Comparing two summaries answers "did the model or template get worse"; no dashboard.

## Rejected

LLM-as-judge scoring (nondeterministic on top of nondeterministic; the id assertions are the ground truth); running the answer tier in CI (cost, flakiness, secrets); synthetic job descriptions; per-requirement expectations for match cases (a template concern).
