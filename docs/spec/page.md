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

Selecting text anywhere in the Hero or the Sections raises the same affordance (accent bars at the selection's ends and the pill ease after the selection as it changes, but stay pinned to the text, unanimated, while the page scrolls) as a pill just below and right of the selection's last line, clear of the browser's own selection menu and clamped to the viewport; it sends the phrase verbatim (whitespace collapsed, 3 to 200 characters) as a **typed** Prompt. Selections inside the header, the pick card or a form field are ignored.

## Navigation

Sticky header: name left, section anchors centre, CV / GitHub / LinkedIn right. Frosted glass throughout (translucent panel plus `backdrop-filter`), deepening once the Hero is scrolled past. Below 960px the anchors step aside so the name and links keep one line each; on phones the name becomes initials and the links stay as icons.

## Generated files

`bun content:render` runs after a web build (separate from `content:index`, which stays free of the app) and uses Playwright to write, committed under `apps/web/static/`:

- `cv.pdf`: one A4 page from the same page model, laid out on a `/print` route in industry order (experience, projects, education, competitive programming, skills, languages) with the portrait. Experience shows its `highlights` bullets (the body when it has none); Education and Projects use one line each; the Person's `cv.skills` sets the story-ordered Skill groups (every Skill by category when absent) and `cv.omit` drops Nodes the site keeps; Projects in the competitive-programming Domain get their own section. The render fails if the PDF runs to a second page. The Person's `links.cv` (`/cv.pdf`) shows the Download CV buttons and a Contact card; it stays out of JSON-LD `sameAs`.
- `hero.png`: the Hero at rest at 1200×630, the link preview behind the `og:image` and `twitter:card` tags (absolute URLs from the request origin). A text-free variant for the no-WebGL and reduced-motion fallback is not rendered yet.

CI runs `content:render --verify` and diffs the PDF's extracted text (whitespace ignored, since wrapping differs between machines) and the PNG's dimensions, not bytes.

## Crawlability and fallbacks

Sections are SSR HTML, so crawlers get the full resume. The Hero swaps the canvas for `hero.png` when WebGL is unavailable or `prefers-reduced-motion` is set; the chat field keeps working. JSON-LD `Person` in the head with `name`, `url`, `sameAs` (links), `alumniOf` (Education Organizations), `worksFor` (current Experience Organization), `knowsAbout` (top Skills).

## Rejected

Scene as a persistent background (GPU cost, contrast fights); separate `/resume` route (splits crawlability from the experience); separately authored section copy; a Projects section listing every Project (owned ones stay under their Experience or Education); a contact form; a hand-made CV as the primary (kept as fallback if the generated one disappoints); a prototype for section-to-Scene interaction (reduced to a canned Prompt).
