# GraphRAG Portfolio

An interactive 3D resume: a visitor asks a question, the Knowledge Graph is queried GraphRAG-style, and the scene highlights the Subgraph that backs the answer.

## Language

### Knowledge

**Knowledge Graph**:
The single-subject graph of the portfolio owner's professional history: skills, projects, experience, education, and how they relate.
_Avoid_: Knowledge backend, database, resume data

**Node**:
One entity in the Knowledge Graph, authored as a single Markdown file with typed frontmatter.
_Avoid_: Entity, record, item

**Edge**:
A typed, directed relationship between two Nodes, declared in the source Node's frontmatter, one of: uses, at, delivered, led, in-domain, part-of, related-to, taught.
_Avoid_: Link, relation, connection

**Node Type**:
One of the seven kinds of Node: Person, Skill, Project, Experience, Education, Organization, Domain.
_Avoid_: Kind, category, label

**Person**:
The single Node representing the portfolio owner, carrying the bio; the Scene's centre and the seed for generic Prompts.
_Avoid_: Subject, owner, root, profile

**Skill**:
A technology or competency, grouped by category and optionally nested under a broader Skill via `part-of`.
_Avoid_: Technology, competency, tag

**Project**:
A bounded piece of work with an outcome, delivered or led during an Experience.
_Avoid_: Work item, case study, portfolio piece

**Experience**:
A role held at an Organization over a time range.
_Avoid_: Job, position, employment, role (which is the job-title field)

**Education**:
A degree or formal programme at an Organization.
_Avoid_: School, study, qualification

**Organization**:
A company, university, client, or community that an Experience or Education is `at`.
_Avoid_: Company, employer, institution

**Domain**:
An industry or problem space that Projects, Experiences, and Organizations operate in.
_Avoid_: Industry, sector, area, field (which is the Education field of study)

**Alias**:
An alternative name for a Skill or Domain, folded into its embedded text so variant spellings in a Prompt reach the same Node.
_Avoid_: Synonym, tag, keyword

**Note**:
The optional one-line text on an Edge that carries concrete evidence for the relationship.
_Avoid_: Description, comment, annotation

**Derived Span**:
The time range of a Skill computed at index time from the Experiences and Projects that use it, never authored by hand.
_Avoid_: Years of experience, level, tenure

### Interaction

**Visitor**:
The person asking questions: a hiring manager, engineer, or sourcer evaluating the portfolio owner.
_Avoid_: Recruiter, user, client

**Prompt**:
One question or pasted job description a Visitor submits.
_Avoid_: Query, message, input

**Turn**:
One full loop: a Prompt, its Retrieval, the Answer, and the resulting Subgraph.
_Avoid_: Round, exchange, request

**Retrieval**:
The step that selects the Subgraph relevant to a Prompt from the Knowledge Graph.
_Avoid_: Search, lookup, RAG step

**Subgraph**:
The set of Nodes and Edges that back one Turn's Answer.
_Avoid_: Result set, context, highlight set

**Delta**:
The difference between the current Turn's Subgraph and the previous Turn's, driving what the scene animates in and out.
_Avoid_: Diff, transition, change set

**Answer**:
The streamed text response to a Prompt, carrying Citations.
_Avoid_: Response, completion, reply

**Citation**:
A reference inside an Answer to one Node or Edge in the Subgraph, written by the LLM as an inline marker and re-emitted by Retrieval as an ordered event.
_Avoid_: Source, reference, footnote

**Candidate Subgraph**:
The Nodes and Edges Retrieval selected before the LLM ran, sent first so the Scene can pre-dim them.
_Avoid_: Context set, pre-highlight

**Used Subgraph**:
The Nodes and Edges the LLM actually cited, validated at the end of a Turn; what remains Highlighted.
_Avoid_: Final set, result

**Marker**:
The inline `[[id]]` token the LLM writes in an Answer to make a Citation.
_Avoid_: Tag, reference token

**Followup**:
A suggested next Prompt returned at the end of a Turn.
_Avoid_: Suggestion, chip, next question

### Scene

**Scene**:
The 3D rendering of the Knowledge Graph the Visitor sees.
_Avoid_: Canvas, visualization, view

**Layout**:
The precomputed position of every Node in the Scene.
_Avoid_: Positions, arrangement, embedding (which means the vector)

**Highlight**:
The visual state of a Node or Edge that belongs to the current Subgraph.
_Avoid_: Selection, focus, active
