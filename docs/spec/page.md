# Page structure spec

Decisions from [Decide: page structure, sections, and crawlable resume rendering](https://github.com/PavelHolman/GraphRAG/issues/19). Scene per `docs/spec/scene.md`, chat per `docs/spec/chat.md`, authoring per `docs/spec/authoring.md`, design language per the scene spec's tokens.

## Shape

One route, `/`. The **Hero** is the first viewport: the Scene with the centred chat field. Sections scroll below it as ordinary server-rendered HTML. The Scene renders on demand only while the Hero is in view (IntersectionObserver pauses the task loop when scrolled away). Phones: the Hero is one screen, the rest is a normal page.

## Sections and their source

Every section renders from the committed Knowledge Graph artifact. Nothing is authored twice.

| #   | Section    | Source                                                                                                                                                       |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Hero       | Scene + chat over the artifact; Turn endpoint                                                                                                                |
| 2   | About      | Person `lede` (new frontmatter field, one or two sentences) and body as Markdown, `location`                                                                 |
| 3   | Experience | Experience Nodes by `start` desc: `role`, Organization title, date range, body, top Skills by Edge notes, Projects it `delivered` or `led` as a compact list |
| 4   | Education  | Education Nodes: `degree`, `field`, Organization, date range, body, Projects it `delivered` (a thesis)                                                       |
| 5   | Projects   | only Projects no Experience or Education `delivered` or `led` (this site, contest results): title, date range, `url`, `repo`, body, Skills it `uses`         |
| 6   | Skills     | grouped by `category` in columns, sorted by Derived Span desc; spans and aliases not shown                                                                   |
| 7   | Contact    | Person `links` (email as `mailto:`, LinkedIn, GitHub) and the CV download; `languages` appear in the About facts                                             |

Projects owned by an Experience or Education appear under it, never twice. No contact form.

## Ask about this

Every Experience, Education, Project and Skill item carries its Node id as an anchor, so the Scene's pick card links straight to it, and a small "ask about this" affordance. It scrolls to the Hero and submits a canned Prompt marked ✦ (for example "Tell me about your time at Acme Bank"), reusing the normal Turn pipeline. No cross-scroll hover highlighting.

Selecting text anywhere in the Hero or the Sections raises the same affordance as a pill over the selection; it sends the selected phrase verbatim (whitespace collapsed, 3 to 200 characters) as a **typed** Prompt. Selections inside the header, the pick card or a form field are ignored.

## Navigation

Sticky header: name left, section anchors centre, CV / GitHub / LinkedIn right. Frosted glass throughout (translucent panel plus `backdrop-filter`), deepening once the Hero is scrolled past. On phones the anchors collapse into a menu; the three links stay as icons.

## Generated files

`bun content:render` runs after a web build (separate from `content:index`, which stays free of the app) and uses Playwright to write, committed under `apps/web/static/`:

- `cv.pdf`: the sections rendered through a print stylesheet on a `/print` route.
- `hero.png` (two sizes): the Scene at rest, rendered from the artifact's Layout, used as the no-WebGL and reduced-motion fallback and as the social preview image.

CI runs `content:render` and diffs the PDF's extracted text and the PNG's dimensions, not bytes.

## Crawlability and fallbacks

Sections are SSR HTML, so crawlers get the full resume. The Hero swaps the canvas for `hero.png` when WebGL is unavailable or `prefers-reduced-motion` is set; the chat field keeps working. JSON-LD `Person` in the head with `name`, `url`, `sameAs` (links), `alumniOf` (Education Organizations), `worksFor` (current Experience Organization), `knowsAbout` (top Skills).

## Rejected

Scene as a persistent background (GPU cost, contrast fights); separate `/resume` route (splits crawlability from the experience); separately authored section copy; a Projects section listing every Project (owned ones stay under their Experience or Education); a contact form; a hand-made CV as the primary (kept as fallback if the generated one disappoints); a prototype for section-to-Scene interaction (reduced to a canned Prompt).
