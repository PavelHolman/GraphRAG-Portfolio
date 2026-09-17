# GraphRAG retrieval strategies for a hand-authored graph

Resolves GitHub issue #4. Researched 2026-09-17 against primary sources only (Microsoft GraphRAG repo/docs/paper, LightRAG repo/paper, nano-graphrag repo). Repo paths cited below are on each project's `main` branch at time of reading.

## Summary

- Every surveyed system's *local* retrieval is the same shape: embed the query, pick top-k nodes by cosine similarity, expand one hop to their edges/neighbours, rank by degree, truncate to a token budget, one LLM call. That shape is the one worth keeping.
- Microsoft's global search and DRIFT search are many-LLM-call map-reduce loops over LLM-written community summaries; both the summaries and the loops only pay off when the graph is too large for one context. A hand-authored graph of hundreds of nodes does not need them.
- LightRAG's dual-level idea (specific keywords -> entity index, thematic keywords -> relationship index) is worth keeping, but its keyword-extraction LLM call can be dropped by embedding the raw prompt (or JD lines) directly.
- Recommended pipeline: precompute node embeddings (and edge-text embeddings) at build time and ship them in the static JSON; at runtime do vector seed + one-hop expansion + degree ranking in the Pages function, then one LLM call whose structured output lists the node/edge ids it used. That id list is the subgraph the 3D scene highlights.
- "Match this job description" is the same pipeline with JD requirement lines as multiple embedding queries seeded on Skill/Experience/Education nodes; "tell me about X" is the same pipeline seeded by title match with vector fallback.

## Findings

### 1. Microsoft GraphRAG

**What the index precomputes.** The default pipeline produces tables for entities (`title`, `type`, `description`, `degree`, `text_unit_ids`), relationships (`source`, `target`, `description`, `weight`, `combined_degree`), communities (`level`, `parent`, `children`, `entity_ids`, `relationship_ids`) and community reports (`level`, `title`, `summary`, `full_content`, `rank`, `findings`). Source: https://microsoft.github.io/graphrag/index/outputs/. Three embeddings are produced by default: `text_unit_text`, `entity_description`, `community_full_content`. Source: https://microsoft.github.io/graphrag/config/yaml/.

**Community summaries** are the paper's core contribution: Leiden is applied recursively "until reaching leaf communities that can no longer be partitioned", then an LLM writes a report per community; leaf-level reports pack element (node/edge) summaries prioritised by "combined source and target node degree" until the token limit, and higher-level reports substitute shorter sub-community summaries when element summaries do not fit. Source: https://arxiv.org/html/2404.16130 (Sections 2.4-2.5). Every community report is an LLM call at index time; this is the artifact with no equivalent in a hand-authored graph unless you write the summaries yourself.

**Local search.**
- Query flow: `map_query_to_entities` embeds the query text and does `similarity_search_by_text(k = top_k_mapped_entities * oversample_scaler)` against the entity-description vector store; there is no LLM call in retrieval. When the query is empty it instead sorts all entities by `rank` (degree) and takes the top k. Source: https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/context_builder/entity_extraction.py.
- Context assembly (`LocalSearchMixedContext.build_context`) splits one `max_context_tokens` budget into `community_prop`, `text_unit_prop`, and the remainder `1 - community_prop - text_unit_prop` for entity + relationship tables; `top_k_relationships` caps the edges kept per matched entity. Source: https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/local_search/mixed_context.py. Defaults: `text_unit_prop = 0.5`, `community_prop = 0.15`, `top_k_entities = 10`, `top_k_relationships = 10`, `max_context_tokens = 12_000`. Source: https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/config/defaults.py (`LocalSearchDefaults`).
- Neighbour ranking: `find_nearest_neighbors_by_entity_rank` picks the entities directly connected to a matched entity and sorts by `rank`. Source: entity_extraction.py above.
- Cost per query: one embedding call + one LLM call ("the system_prompt is used to generate the search response"). Source: https://microsoft.github.io/graphrag/query/local_search/.
- Subgraph mapping: the context builder returns the selected entity rows and relationship rows (with ids) as `context_records`; the highlighted subgraph is exactly those rows. Community reports and text units are extras a hand-authored graph does not have (the node's Markdown body plays the text-unit role).

**Global search.**
- Method: "community reports are segmented into text chunks of pre-defined size. Each text chunk is then used to produce an intermediate response containing a list of points"; then "a filtered set of the most important points from the intermediate responses are aggregated and used as the context to generate the final response". Source: https://microsoft.github.io/graphrag/query/global_search/.
- The paper describes the same map-reduce: summaries are "randomly shuffled and divided into chunks of pre-specified token size", each map call also emits a 0-100 helpfulness score, and reduce sorts by that score. Source: https://arxiv.org/html/2404.16130 (Section 2.6).
- Cost: `search()` gathers `_map_response_single_batch` over every batch (each `llm_calls=1`) and then one `_reduce_response`; total = number of community-report batches + 1. Source: https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/global_search/search.py. Optional `DynamicCommunitySelection` adds an LLM relevancy rating per community, walking from level 0 down to `max_level` (default 2) and only descending into children rated >= `threshold`. Source: https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/context_builder/dynamic_community_selection.py. Defaults `map_max_length = 1000`, `reduce_max_length = 2000`, `data_max_tokens = 12_000`. Source: defaults.py (`GlobalSearchDefaults`).
- The docs call it a "resource-intensive method, but often gives good responses for questions that require an understanding of the dataset as a whole". Source: https://microsoft.github.io/graphrag/query/overview/.
- Subgraph mapping: weak. Output is a set of community ids, each owning `entity_ids`/`relationship_ids`; you can highlight whole communities, but the LLM's points are not tied to specific nodes.
- Precomputed inputs: community hierarchy plus one LLM-written report per community. Not applicable without an extraction step unless summaries are hand-written.

**DRIFT search.**
- Method: a primer phase "compares the user's query with the top K most semantically relevant community reports, generating a broad initial answer and follow-up questions", then follow-ups run local search "producing additional intermediate answers and follow-up questions", ending in "a hierarchical structure of questions and answers ranked by relevance". Source: https://microsoft.github.io/graphrag/query/drift_search/.
- Cost: the primer runs `expand_query` (a HyDE-style LLM call) and then `decompose_query` once per report fold (`primer_folds`, default 5); the loop then runs `n_depth` epochs (default 3), each firing up to `drift_k_followups` (default 20) local searches, each one LLM call; a final reduce adds one more. Sources: https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/drift_search/primer.py, https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/drift_search/search.py, https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/config/defaults.py (`DriftSearchDefaults`). At defaults that is on the order of 1 + 5 + 3 x 20 + 1 calls per query.
- Precomputed inputs: community reports with `community_full_content` embeddings plus everything local search needs.
- Subgraph mapping: each follow-up local search yields entity/relationship rows, so the union is a subgraph, but there is no single ranked set. Not applicable at one call per turn.

### 2. LightRAG

**Index artifacts.** Four storages: KV (chunks, extraction results, LLM cache), vector (chunks, entities, relationships), graph, and doc status. Source: https://github.com/HKUDS/LightRAG/blob/main/README.md. Relevant to us: a *relationship* vector index in addition to an entity one.

**Dual-level retrieval.** The paper distinguishes specific queries ("detail-oriented and typically reference specific entities within the graph") from abstract queries ("broader topics, summaries, or overarching themes that are not directly tied to specific entities"), and the algorithm matches "local query keywords with candidate entities and global query keywords with relations", then gathers "neighboring nodes within the local subgraphs of the retrieved graph elements". Source: https://arxiv.org/html/2410.05779 (Section 3.2, "Dual-level Retrieval Paradigm" and "Integrating Graph and Vectors").

**Query flow in code** (`lightrag/operate.py`):
- `kg_query` first calls `get_keywords_from_query` -> `extract_keywords_only`, one LLM call with `PROMPTS["keywords_extraction"]` returning JSON `{"high_level_keywords": [...], "low_level_keywords": [...]}`; high-level = "overarching concepts or themes", low-level = "specific entities or details ... proper nouns, technical jargon". Sources: https://github.com/HKUDS/LightRAG/blob/main/lightrag/operate.py (`kg_query`, `extract_keywords_only`), https://github.com/HKUDS/LightRAG/blob/main/lightrag/prompt.py (`keywords_extraction`).
- Mode dispatch: `local` -> `_get_node_data(ll_keywords)` queries `entities_vdb` top-k, fetches node degrees, then `_find_most_related_edges_from_entities` collects all incident edges and ranks by degree + weight; `global` -> `_get_edge_data(hl_keywords)` queries `relationships_vdb` top-k and then `_find_most_related_entities_from_relationships` pulls the endpoints; `hybrid` does both; `mix` (the default) additionally does a plain chunk vector search. Source: operate.py, `_build_query_context` mode branch, `_get_node_data`, `_get_edge_data`; mode definitions in README.md.
- `QueryParam.top_k` "Represents entities in 'local' mode and relationships in 'global' mode"; separate `max_entity_tokens`, `max_relation_tokens`, `max_total_tokens` budgets truncate the context. Source: https://github.com/HKUDS/LightRAG/blob/main/lightrag/base.py (`QueryParam`).
- The retrieval stages are enumerated as `EXTRACTING_KEYWORDS`, `RETRIEVING_ENTITIES`, `RETRIEVING_RELATIONS`, `RETRIEVING_CHUNKS`. Source: operate.py (`QueryProgress`).

**Cost per query.** Two LLM calls (keyword extraction, answer) plus embedding calls for the keyword strings. The paper contrasts this with GraphRAG global search on the same dataset: GraphRAG retrieval "610,000 tokens" and "hundreds of API calls" versus LightRAG "fewer than 100 tokens" and "only a single API call" for the retrieval step. Source: https://arxiv.org/html/2410.05779 (Section 4, "Model Cost and Adaptability Analysis"). The keyword-extraction call is what they count as the single retrieval call; the answer call is on top.

**Subgraph mapping.** Strong. Both branches return explicit entity rows (`entity_name`, `rank`) and relationship rows (`src_id`, `tgt_id`, `weight`), and `raw_data` on the `QueryResult` carries them alongside the answer. Source: operate.py (`kg_query` docstring, `_get_node_data`, `_get_edge_data`).

**Precomputed inputs.** Entity embeddings (name + description) and relationship embeddings (keywords + description); no community summaries. Everything LightRAG embeds at index time can be produced from a hand-authored node's title, type, Markdown body, and edge label without an LLM.

### 3. nano-graphrag

**What it is.** "a smaller, faster, cleaner GraphRAG, while remaining the core functionality", about 1100 lines excluding tests and prompts, written because the reference implementation is "difficult/painful to read or hack". Source: https://github.com/gusye1234/nano-graphrag/blob/main/readme.md.

**Precomputes.** Entity vector store (`entities_vdb`), Leiden clusters with `max_graph_cluster_size = 10`, LLM-written community reports (`generate_community_report`), and optional node2vec node embeddings (`node_embedding_algorithm = "node2vec"`). Source: https://github.com/gusye1234/nano-graphrag/blob/main/nano_graphrag/graphrag.py.

**Local query** (`_build_local_query_context` -> `local_query`): `entities_vdb.query(query, top_k)` (default 20), then three helpers each truncated to a budget summing to 12,000 tokens: `_find_most_related_community_from_entities` (communities read off the node's `clusters` attribute, sorted by hit count then report rating; `local_max_token_for_community_report = 3200`), `_find_most_related_text_unit_from_entities` (walks one-hop neighbours to score chunks; `local_max_token_for_text_unit = 4000`), `_find_most_related_edges_from_entities` (all incident edges, sorted by `(rank, weight)` where rank is edge degree; `local_max_token_for_local_context = 4800`), then exactly one `use_model_func` call. Sources: https://github.com/gusye1234/nano-graphrag/blob/main/nano_graphrag/_op.py, https://github.com/gusye1234/nano-graphrag/blob/main/nano_graphrag/base.py (`QueryParam`).

**Global query** (`global_query`): filters communities by `level <= query_param.level` (default 2) and `rating >= global_min_community_rating`, sorts by occurrence, batches reports into 16,384-token groups, `_map_global_communities` runs one LLM call per group in parallel (`asyncio.gather`), then one reduce call. Total = groups + 1. Source: _op.py.

**Cost split.** Two model tiers: `best_model_func` (default GPT-4o) for query answers, `cheap_model_func` (GPT-4o-mini) for summaries. Source: readme.md and graphrag.py.

**Subgraph mapping.** Same as Microsoft local search: the context is built from explicit entity and edge lists (`src_tgt`, `rank`, `weight`, `description`), so the highlighted subgraph is the entity list plus the surviving edges.

### 4. What transfers to a hand-authored graph with no extraction step

| Idea | Keep? | Why |
|---|---|---|
| Query -> node embedding similarity as seed (all three) | Yes | Needs only node embeddings; zero LLM calls; every system does it. |
| One-hop expansion + degree ranking (LightRAG `_find_most_related_edges_from_entities`, MS `find_nearest_neighbors_by_entity_rank`, nano `_find_most_related_edges_from_entities`) | Yes | Pure graph ops over static JSON; this is what produces the edge set to highlight. |
| Separate relationship embedding index queried by thematic keywords (LightRAG global/hybrid) | Yes, cheaply | Hand-authored edges have a type and endpoints; embed `"{src.title} {edge.type} {dst.title}"` (plus any note). Gives the abstract-question path without communities. |
| Token-budget split across entity/edge/body text (all three) | Yes | Replace text units with node Markdown bodies; keep proportional truncation. |
| LLM keyword extraction as a separate call (LightRAG) | No | Costs a second call. Embed the raw prompt (or JD lines) instead; optionally ask the answer call for follow-up keywords for the *next* turn. |
| Community detection + LLM community reports (MS, nano) | No (optionally hand-written) | Reports are LLM-authored at index time; the type hierarchy (Skill/Project/Experience/Education) already provides the high-level grouping. If a global-style answer is wanted, a hand-written summary per type or per project cluster can be shipped as a pseudo-community-report and retrieved by embedding. |
| Global search map-reduce | No | N+1 LLM calls per query; the whole graph of hundreds of nodes fits in one context anyway. |
| DRIFT primer + follow-up loop | No | Dozens of LLM calls per query. Its follow-up-question idea survives as suggestion chips that cost one call per user click. |
| node2vec structural embeddings (nano-graphrag option) | No | Not used in the query path. |

## Recommendation

### Precomputed artifacts (build step, no LLM required)

1. `graph.json`: nodes `{id, type, title, body_md, degree}` and edges `{id, src, dst, type, note?}`; plus adjacency lists so one-hop expansion is O(degree).
2. `node_embeddings` (JSON or Float32 blob): one vector per node over `"{type}: {title}\n{body_md}"`. Analogue of GraphRAG's `entity_description` embedding and LightRAG's `entities_vdb`.
3. `edge_embeddings`: one vector per edge over `"{src.title} {edge.type} {dst.title} {note}"`. Analogue of LightRAG's `relationships_vdb`; enables the thematic retrieval path.
4. Optional `summaries.json`: hand-written one-paragraph summaries per node type and per major project cluster, embedded like nodes and tagged `kind: summary`. Stands in for community reports for questions like "what are you good at overall".
5. Use a small embedding model (Workers AI or an external API) at build time; the runtime needs the same model only to embed the query.

With hundreds of nodes, brute-force cosine over all vectors inside the Pages function is fine (hundreds x 384-1024 floats).

### Runtime pipeline (one LLM call per turn)

```
prompt
  -> classify by cheap heuristics (no LLM):
       pasted JD  = long text, many requirement lines  -> mode "match"
       "tell me about X" / short mention of a title    -> mode "entity"
       otherwise                                        -> mode "hybrid"
  -> seed selection
       entity: exact / fuzzy title match on nodes; fallback top-k node cosine
       match:  split JD into requirement lines; embed each; top-k node cosine
               per line restricted to Skill/Experience/Education types; union
       hybrid: top-k node cosine + top-k edge cosine (LightRAG hybrid shape)
  -> one-hop expansion over adjacency; rank edges by (degree, type weight)
  -> budget: seeds' full body_md, neighbours' title+type only, edges as
     "src --type--> dst" lines, truncated to roughly 60% / 15% / 25%
  -> one LLM call with structured output:
       { answer_md, used_node_ids[], used_edge_ids[], followups[] }
  -> scene highlights used_node_ids + used_edge_ids (seeds emphasised,
     neighbours dimmer); followups become suggestion chips (a click re-runs
     the pipeline with that question: DRIFT's loop, one user turn at a time)
```

- "Match this pasted job description": the JD is the query. Embedding requirement lines separately gives many sharp seeds instead of one blurry one, so JD language ("Kubernetes") lands on specific Skill nodes, and one-hop expansion pulls in the Project/Experience nodes that evidence each skill. Ask the LLM for a per-requirement table citing node ids; the scene can highlight per row.
- "Tell me about X": title match first (hand-authored titles are authoritative), vector fallback second; expand one hop; the answer is grounded on X's body plus its neighbours. If X is a type name ("your education"), seed with every node of that type instead.
- Validate `used_node_ids`/`used_edge_ids` server-side against the ids that were in the context and drop anything else, so highlighting never points at nothing.

### Why not the alternatives

- Global and DRIFT search need community reports that would have to be LLM- or hand-written, and cost N+1 or dozens of calls per query; the graph is small enough that the local shape with a generous budget already sees most of it.
- LightRAG's separate keyword-extraction call buys precision on long ambiguous prompts; for the JD case, splitting the JD into lines gives the same effect without the call.

## Open questions

1. Which embedding model runs at build time and query time (Workers AI `@cf/baai/bge-*` vs external)? Query-time embedding is an extra HTTP call even if not an LLM call; if that is unacceptable, a build-time BM25/keyword index over titles and bodies is the fallback (weaker for JD matching).
2. Should edge type carry a weight for ranking (e.g. `USED_IN` > `RELATED_TO`)? All surveyed systems rank by degree and a numeric weight; hand-authored edges have neither unless we define them.
3. Is one hop enough for JD matching (Skill -> Project), or do we need two (Skill -> Project -> Experience)? Two hops with a degree cap is still cheap on hundreds of nodes but needs a budget rule.
4. Do we want hand-written per-type/per-cluster summaries at all, or is "what are you good at overall" served well enough by seeding on the top-degree nodes (Microsoft's empty-query branch in `map_query_to_entities` does exactly this)?
5. Multi-turn: LightRAG and Microsoft both pass conversation history into the context builder; with one call per turn we need to decide whether the previous turn's `used_node_ids` are carried as extra seeds.
