<script lang="ts">
  // One A4 page in industry order: experience, projects, education, competitive programming,
  // skills, languages. Rendered from the same page model as the site, so nothing is authored
  // twice; `bun content:render` prints it to `static/cv.pdf`. docs/spec/page.md.
  import portrait from '$lib/cv/portrait.jpg';
  let { data } = $props();
  const m = $derived(data.model);
  const p = $derived(m.person);

  const COMPETITIVE = 'domain/competitive-programming';
  // Categories in the order a reader scans for them; anything new lands at the end.
  const CATEGORIES = ['language', 'framework', 'platform', 'practice', 'leadership'];

  const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
  const today = Temporal.Now.plainDateISO().toString();
  // "2025-09 – 2027-06" → "Sep 2025 – Jun 2027 (expected)".
  const dates = (range: string): string =>
    range
      .replace(/^(\d{4}-\d{2})(-\d{2})? – \1(-\d{2})?$/, '$1')
      .replace(/(\d{4})-(\d{2})(-\d{2})?/g, (iso, y: string, mo: string) => {
        const label = `${MONTHS[Number(mo) - 1]} ${y}`;
        return iso > today ? `${label} (expected)` : label;
      });
  // The Person's `cv.omit` keeps the page to one sheet; the site still shows those Nodes.
  const kept = <T extends { id: string }>(xs: ReadonlyArray<T>) =>
    xs.filter((x) => !p.cv.omit.includes(x.id));
  // Degrees get an entry each; exchanges, coursework and workshops one line each beneath them.
  const degrees = $derived(kept(m.education).filter((e) => e.degree));
  const courses = $derived(kept(m.education).filter((e) => !e.degree));
  // The body already names every owned Project; the line below it is there for the links.
  const linked = <T extends { url: string | undefined }>(xs: ReadonlyArray<T>) =>
    xs.filter((x) => x.url);
  const handle = (href: string) => href.replace(/\/$/, '').split('/').pop() ?? href;
  const bare = (href: string) => href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  const contacts = $derived(
    [
      p.links.email && { href: p.links.email, text: p.links.email.replace(/^mailto:/, '') },
      p.links.github && { href: p.links.github, text: `github.com/${handle(p.links.github)}` },
      p.links.linkedin && { href: p.links.linkedin, text: 'LinkedIn' },
      p.links.codeforces && {
        href: p.links.codeforces,
        text: `Codeforces: ${handle(p.links.codeforces)}`,
      },
    ].filter((c): c is { href: string; text: string } => Boolean(c)),
  );
  const projects = $derived(kept(m.projects).filter((x) => !x.domains.includes(COMPETITIVE)));
  const contests = $derived(kept(m.projects).filter((x) => x.domains.includes(COMPETITIVE)));
  // Curated groups when the Person defines them, else every Skill by category.
  const skills = $derived(
    p.cv.skills.length
      ? p.cv.skills.map((g) => ({ label: g.group, titles: g.titles }))
      : [...m.skills]
          .sort(
            (a, b) =>
              (CATEGORIES.indexOf(a.category) + 1 || 99) -
              (CATEGORIES.indexOf(b.category) + 1 || 99),
          )
          .map((g) => ({ label: g.category, titles: g.skills.map((s) => s.title) })),
  );
</script>

<svelte:head>
  <title>{p.name} – CV</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="cv">
  <header>
    <div>
      <h1>{p.name}</h1>
      {#if p.headline}<p class="headline">{p.headline}</p>{/if}
      <p class="contact">
        {#if p.location}<span>{p.location}</span>{/if}
        {#each contacts as c (c.href)}<a href={c.href}>{c.text}</a>{/each}
      </p>
      {#if p.lede}<p class="lede">{p.lede}</p>{/if}
    </div>
    <img src={portrait} alt="" />
  </header>

  <section>
    <h2>Experience</h2>
    {#each m.experience as x (x.id)}
      <article>
        <div class="row">
          <h3>
            {x.role ?? x.title}{#if x.organization}<span class="org"
                >{' · '}{#if x.organizationUrl}<a href={x.organizationUrl}>{x.organization}</a
                  >{:else}{x.organization}{/if}</span
              >{/if}
          </h3>
          <span class="when">{dates(x.range)}</span>
        </div>
        {#if x.highlights.length}
          <ul>
            {#each x.highlights as h (h)}<li>{h}</li>{/each}
          </ul>
        {:else}
          <p>{x.body}</p>
        {/if}
        {#if linked(x.projects).length}
          <p class="owned">
            {#each linked(x.projects) as o, i (o.id)}{#if i}<span class="sep">
                  ·
                </span>{/if}{#if o.url}<a href={o.url}>{o.title}</a>{:else}<b>{o.title}</b
                >{/if}{#if x.highlights.length && o.url}{' '}<a class="url" href={o.url}
                  >{bare(o.url)}</a
                >{:else if o.summary}: {o.summary}{/if}{/each}
          </p>
        {/if}
      </article>
    {/each}
  </section>

  {#if projects.length}
    <section>
      <h2>Projects</h2>
      {#each projects as x (x.id)}
        <article>
          <div class="row">
            <h3>
              {#if x.url ?? x.repo}<a href={x.url ?? x.repo}>{x.title}</a>{:else}{x.title}{/if}
            </h3>
            <span class="when">{dates(x.range)}</span>
          </div>
          <p>
            {x.summary ?? ''}{#if x.repo}{' '}<a class="url" href={x.repo}>{bare(x.repo)}</a>{/if}
          </p>
        </article>
      {/each}
    </section>
  {/if}

  <section>
    <h2>Education</h2>
    {#each degrees as e (e.id)}
      <article>
        <div class="row">
          <h3>
            {[e.degree, e.field].filter(Boolean).join(' in ')}{#if e.organization}<span class="org"
                >{' · '}{e.organization}</span
              >{/if}
          </h3>
          <span class="when">{dates(e.range)}</span>
        </div>
        {#each e.projects as t (t.id)}
          <p class="owned">
            Thesis{t.end && t.end > today ? ' (in progress)' : ''}: {#if t.url}<a href={t.url}
                >{t.title}</a
              >{:else}<b>{t.title}</b>{/if}
          </p>
        {/each}
      </article>
    {/each}
    {#each courses as e (e.id)}
      <article>
        <div class="row">
          <h3>{e.organization ?? e.title}</h3>
          <span class="when">{dates(e.range)}</span>
        </div>
        {#if e.organization}<p class="owned">{e.title}</p>{/if}
      </article>
    {/each}
  </section>

  {#if contests.length}
    <section>
      <h2>Competitive programming</h2>
      <ul>
        <!-- A Project summary of the form "A; B" prints as two bullets. -->
        {#each contests as x (x.id)}
          {#each (x.summary ?? x.title).split('; ') as part (part)}<li>{part}</li>{/each}
        {/each}
      </ul>
    </section>
  {/if}

  <section>
    <h2>Skills</h2>
    <dl class="skills">
      {#each skills as g (g.label)}
        <dt>{g.label}</dt>
        <dd>{g.titles.join(', ')}</dd>
      {/each}
    </dl>
  </section>

  {#if Object.keys(p.languages).length}
    <section>
      <h2>Languages</h2>
      <ul>
        {#each Object.entries(p.languages) as [lang, level] (lang)}<li>{lang}: {level}</li>{/each}
      </ul>
    </section>
  {/if}
</main>

<style>
  @page {
    size: A4;
    margin: 0;
  }
  /* The site's layout paints the dark theme on html and body; paper is light. */
  :global(html:has(.cv)),
  :global(html:has(.cv) body) {
    background: #fff;
    color: #1b1a19;
    font-size: 8.5pt;
    line-height: 1.36;
  }
  .cv {
    --ink: #1b1a19;
    --muted: #6b6862;
    --accent: #c4502f;
    --rule: #e4e0d9;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 12mm 14mm 10mm;
    color: var(--ink);
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  header {
    display: grid;
    grid-template-columns: 1fr 27mm;
    gap: 6mm;
    align-items: start;
    margin-bottom: 3.5mm;
  }
  header img {
    width: 27mm;
    height: 33.75mm;
    object-fit: cover;
    border-radius: 2mm;
  }
  h1 {
    margin: 0;
    font:
      600 22pt/1.1 'Bricolage Grotesque',
      sans-serif;
    letter-spacing: -0.01em;
  }
  .headline {
    margin: 1mm 0 0;
    color: var(--accent);
    font-weight: 600;
    font-size: 10.5pt;
  }
  .contact {
    display: flex;
    flex-wrap: wrap;
    gap: 0 3.5mm;
    margin: 1.5mm 0 0;
    color: var(--muted);
  }
  .contact a {
    color: var(--ink);
    border-bottom: 0.2mm solid var(--rule);
  }
  .lede {
    margin: 2.5mm 0 0;
  }
  section {
    margin-top: 3mm;
  }
  h2 {
    margin: 0 0 1.5mm;
    padding-bottom: 0.8mm;
    border-bottom: 0.3mm solid var(--rule);
    color: var(--accent);
    font:
      600 8pt/1.2 'DM Sans',
      sans-serif;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  article {
    margin-bottom: 2mm;
    break-inside: avoid;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 4mm;
    align-items: baseline;
  }
  h3 {
    margin: 0;
    font-size: 9.2pt;
    font-weight: 600;
  }
  .org {
    font-weight: 400;
  }
  .org a,
  h3 a,
  .owned a,
  .url {
    border-bottom: 0.2mm solid var(--rule);
  }
  .when {
    flex: none;
    color: var(--muted);
    font-size: 8pt;
  }
  p {
    margin: 0.6mm 0 0;
  }
  ul {
    margin: 0.6mm 0 0;
    padding-left: 4mm;
  }
  li {
    margin-top: 0.3mm;
  }
  li::marker {
    color: var(--accent);
  }
  .owned {
    color: var(--muted);
  }
  .owned a,
  .owned b {
    color: var(--ink);
    font-weight: 600;
  }
  .url,
  .owned a.url {
    color: var(--muted);
    font-weight: 400;
  }
  .skills {
    display: grid;
    grid-template-columns: 27mm 1fr;
    gap: 0.6mm 3mm;
    margin: 0;
  }
  .skills dt {
    color: var(--muted);
    text-transform: capitalize;
  }
  .skills dd {
    margin: 0;
  }
  @media screen {
    :global(html:has(.cv)),
    :global(html:has(.cv) body) {
      background: #d8d4cd;
    }
    .cv {
      margin: 8mm auto;
      background: #fff;
      box-shadow: 0 2mm 8mm rgba(0, 0, 0, 0.18);
    }
  }
</style>
