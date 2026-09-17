---
status: accepted
---

# Knowledge Graph taxonomy: typed Markdown Nodes with frontmatter Edges

The Knowledge Graph is hand-authored, single-subject, and consumed by GraphRAG-style local search that embeds both Nodes and Edges and asks the LLM to cite them by id. We model it as seven Node Types (Person, Skill, Project, Experience, Education, Organization, Domain), each a Markdown file at `content/<type>/<slug>.md` whose id is `<type>/<slug>`, with typed Edges declared in the source Node's frontmatter and validated by Effect Schema at build time. The Markdown body is written for the LLM (dense, factual), not as resume prose; the Answer supplies narrative per Prompt.

## Node Types

| Type         | Instances   | Per-type fields                                                                                                |
| ------------ | ----------- | -------------------------------------------------------------------------------------------------------------- |
| Person       | exactly one | `location`, `links` (label → URL), `languages` (language → proficiency)                                        |
| Skill        | many        | `category` ∈ `language \| framework \| platform \| practice \| leadership`, `aliases`                          |
| Project      | many        | `start`, `end`, `url`, `repo`                                                                                  |
| Experience   | many        | `start` (required), `end`, `role`, `employment` ∈ `full-time \| part-time \| contract \| freelance \| founder` |
| Education    | many        | `start`, `end`, `degree`, `field`                                                                              |
| Organization | many        | `url`, `location`, `kind` ∈ `company \| university \| client \| community`                                     |
| Domain       | many        | `aliases`                                                                                                      |

Common fields on every Node: `title` (required), `summary` (optional one-liner for labels and hover cards), `hidden` (default `false`: present in the graph, never rendered or cited), and the Edge lists below. A Node Type with fewer than two real instances is not added; the Person Node is the sole exception.

## Edge vocabulary

Edges are directed, declared on the source Node, keyed by Edge type. Each entry is `{ to, note? }` or the bare `to` string as shorthand.

| Edge         | From                              | To           |
| ------------ | --------------------------------- | ------------ |
| `uses`       | Project, Experience               | Skill        |
| `at`         | Experience, Education             | Organization |
| `delivered`  | Experience, Education             | Project      |
| `led`        | Experience                        | Project      |
| `in-domain`  | Project, Experience, Organization | Domain       |
| `part-of`    | Skill                             | Skill        |
| `related-to` | Skill                             | Skill        |
| `taught`     | Education                         | Skill        |

The Person Node declares no Edges; it is implicitly connected to every Node. `note` is optional; when absent, the indexer embeds a template sentence ("<source title> uses <target title>"). Notes on `uses` Edges are where the concrete evidence lives and are what make a job-description match convincing. The build fails on a dangling `to` reference or an Edge type not permitted for the source Node Type.

## Time

Experience and Education carry `start` and optional `end`; Project carries both optionally. Values are ISO strings at day (`2021-03-15`) or month (`2021-03`) precision, parsed into `Temporal.PlainDate` or `Temporal.PlainYearMonth` by a custom Effect Schema. Skills carry no authored time: their spans are derived at index time from the Experiences and Projects that `use` them and written into the static graph, never into frontmatter.

## Considered and rejected

- **Experience as an Edge from Organization.** Rejected: a role has its own body, its own Projects, and must be citable and highlighted on its own; Edges carry one-line notes, not paragraphs.
- **Skill levels or hand-maintained years.** Rejected: self-assessed levels are the least trusted claim on a resume. Derived spans and Edge notes carry the evidence.
- **Flat Skills or a deep skill tree.** Rejected in favour of `category` plus `part-of`: category drives Scene clustering and `part-of` lets a Prompt asking for "frontend" reach Svelte, without the authoring cost of arbitrary depth.
- **Required notes on every Edge.** Rejected: it would stall authoring; the template fallback keeps every Edge embeddable.
- **`role` on Project.** Rejected: `led` versus `delivered` from the Experience already expresses ownership.

## Consequences

- `aliases` on Skill and Domain are appended to the Node's embedded text, so "React.js" and "React" land on one Node without a lookup table.
- Renaming a file renames the id; the build catches every reference.
- The retrieval pipeline and package seams decisions cite this ADR for the shape of the static graph they consume and produce.
