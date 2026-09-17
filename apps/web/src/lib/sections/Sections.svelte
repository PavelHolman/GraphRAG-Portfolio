<script lang="ts">
  // About, Experience, Education, Skills, Contact: server-rendered from the artifact, in a single
  // centred column with big section titles, alternating backgrounds and soft cards. docs/spec/page.md.
  import type { PageModel } from './model.ts';
  interface Props {
    model: PageModel;
    onask: (prompt: string) => void;
  }
  let { model, onask }: Props = $props();
  const paragraphs = (body: string) => body.split(/\n\s*\n/).filter((p) => p.trim());
  const ask = (prompt: string) => () => onask(prompt);
  const linkLabel = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
  const linkValue = (href: string) =>
    href
      .replace(/^mailto:/, '')
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/$/, '');
  const email = $derived(model.person.links.email);
</script>

<section id="about" class="section">
  <div class="container">
    <h2>About</h2>
    <div class="two">
      <article class="card">
        {#if model.person.lede}<p class="lede">{model.person.lede}</p>{/if}
        {#each paragraphs(model.person.body) as p (p)}<p>{p}</p>{/each}
      </article>
      <aside class="card facts">
        <h3>Details</h3>
        <dl>
          <dt>Name</dt>
          <dd>{model.person.name}</dd>
          {#if model.person.headline}<dt>Role</dt>
            <dd>{model.person.headline}</dd>{/if}
          {#if model.person.location}<dt>Location</dt>
            <dd>{model.person.location}</dd>{/if}
          {#if email}<dt>Email</dt>
            <dd><a href={email}>{linkValue(email)}</a></dd>{/if}
        </dl>
        <button class="ask" onclick={ask('Give me a short overview of your career')}
          >✦ ask for an overview</button
        >
      </aside>
    </div>
  </div>
</section>

<section id="experience" class="section alt">
  <div class="container">
    <h2>Experience</h2>
    <div class="stack">
      {#each model.experience as x (x.id)}
        <article class="card">
          <header>
            <h3>{x.role ?? x.title}</h3>
            <p class="meta">
              <span class="org">{x.organization ?? ''}</span>{#if x.organization && x.range}<span
                  class="sep">·</span
                >{/if}<span>{x.range}</span>
            </p>
          </header>
          {#each paragraphs(x.body) as p (p)}<p>{p}</p>{/each}
          {#if x.projects.length}
            <ul class="projects">
              {#each x.projects as p (p.id)}
                <li>
                  <b>{p.title}</b>{#if p.led}<span class="tag">led</span>{/if}
                  {#if p.summary}<span class="sum">{p.summary}</span>{/if}
                </li>
              {/each}
            </ul>
          {/if}
          {#if x.skills.length}
            <ul class="chips">
              {#each x.skills as s (s.title)}<li title={s.note ?? ''}>{s.title}</li>{/each}
            </ul>
          {/if}
          <button
            class="ask"
            onclick={ask(
              `Tell me about your time as ${x.role ?? x.title}${x.organization ? ` at ${x.organization}` : ''}`,
            )}>✦ ask about this</button
          >
        </article>
      {/each}
    </div>
  </div>
</section>

{#if model.education.length}
  <section id="education" class="section">
    <div class="container">
      <h2>Education</h2>
      <div class="stack">
        {#each model.education as e (e.id)}
          <article class="card">
            <header>
              <h3>{[e.degree, e.field].filter(Boolean).join(' in ') || e.title}</h3>
              <p class="meta">
                <span class="org">{e.organization ?? ''}</span>{#if e.organization && e.range}<span
                    class="sep">·</span
                  >{/if}<span>{e.range}</span>
              </p>
            </header>
            {#each paragraphs(e.body) as p (p)}<p>{p}</p>{/each}
            <button class="ask" onclick={ask(`Tell me about your ${e.title}`)}
              >✦ ask about this</button
            >
          </article>
        {/each}
      </div>
    </div>
  </section>
{/if}

<section id="skills" class="section alt">
  <div class="container">
    <h2>Skills</h2>
    <div class="grid">
      {#each model.skills as g (g.category)}
        <article class="card">
          <h3 class="cat">{g.category}</h3>
          <ul class="chips">
            {#each g.skills as s (s.id)}
              <li>
                <button
                  class="chip"
                  title={s.summary ?? ''}
                  onclick={ask(`Tell me about your ${s.title} work`)}
                  >{s.title}{#if s.span}<span class="span">{s.span}</span>{/if}</button
                >
              </li>
            {/each}
          </ul>
        </article>
      {/each}
    </div>
  </div>
</section>

<section id="contact" class="section">
  <div class="container">
    <h2>Contact</h2>
    <div class="grid">
      {#each Object.entries(model.person.links) as [k, href] (k)}
        <a
          class="card contact"
          {href}
          rel="me noopener"
          target={href.startsWith('mailto:') ? undefined : '_blank'}
        >
          <span class="label">{linkLabel(k)}</span>
          <span class="value">{linkValue(href)}</span>
        </a>
      {/each}
    </div>
  </div>
</section>

<style>
  .section {
    padding: 80px 0;
    background: var(--bg);
  }
  .section.alt {
    background: var(--bg-soft);
  }
  .container {
    max-width: 1024px;
    margin: 0 auto;
    padding: 0 16px;
  }
  h2 {
    font:
      600 34px/1.15 'Bricolage Grotesque',
      sans-serif;
    text-align: center;
    margin: 0 0 40px;
    color: var(--fg);
  }
  h3 {
    font:
      600 22px/1.2 'Bricolage Grotesque',
      sans-serif;
    margin: 0 0 6px;
    color: var(--accent);
  }
  .cat {
    color: var(--fg);
    font-size: 18px;
    text-transform: capitalize;
    margin-bottom: 14px;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 28px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
  }
  .two {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
    align-items: start;
  }
  .stack {
    display: grid;
    gap: 20px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 20px;
  }
  p {
    margin: 0 0 12px;
    line-height: 1.7;
    font-size: 15px;
  }
  .lede {
    font-size: 19px;
    line-height: 1.5;
    color: var(--fg);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font:
      11px/1.6 'Azeret Mono',
      monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted);
    margin-bottom: 14px;
  }
  .org {
    color: var(--fg);
  }
  .sep {
    color: var(--fg-muted);
  }
  .facts h3 {
    color: var(--fg);
    font-size: 18px;
    margin-bottom: 14px;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 16px;
    margin: 0 0 18px;
    font-size: 14px;
  }
  dt {
    color: var(--fg-muted);
  }
  dd {
    margin: 0;
  }
  dd a {
    color: var(--fg);
    text-decoration: none;
    border-bottom: 1px solid var(--line);
  }
  dd a:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0 0 14px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chips li {
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 5px 12px;
    font-size: 13px;
    color: var(--fg-muted);
    background: var(--bg-soft);
  }
  .chips li:has(.chip) {
    padding: 0;
  }
  .chip {
    background: none;
    border: 0;
    color: var(--fg);
    padding: 6px 12px;
    font:
      13px 'DM Sans',
      sans-serif;
    cursor: pointer;
    display: inline-flex;
    gap: 8px;
    align-items: baseline;
  }
  .chip .span {
    font:
      9px/1 'Azeret Mono',
      monospace;
    letter-spacing: 0.06em;
    color: var(--fg-muted);
  }
  .chips li:hover {
    border-color: var(--accent);
  }
  .chips li:hover .chip {
    color: var(--accent);
  }
  .projects li {
    padding: 8px 0;
    border-top: 1px solid var(--line);
    font-size: 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    align-items: baseline;
  }
  .projects .sum {
    color: var(--fg-muted);
  }
  .tag {
    font:
      9px/1 'Azeret Mono',
      monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .ask {
    background: none;
    border: 1px solid var(--line);
    color: var(--fg-muted);
    border-radius: 999px;
    padding: 6px 14px;
    font:
      12px 'DM Sans',
      sans-serif;
    cursor: pointer;
    margin-top: 6px;
  }
  .ask:hover {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .contact {
    display: grid;
    gap: 6px;
    text-decoration: none;
    color: var(--fg);
  }
  .contact .label {
    font:
      10px/1 'Azeret Mono',
      monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }
  .contact .value {
    font-size: 16px;
    word-break: break-all;
  }
  .contact:hover {
    border-color: var(--accent);
  }
  .contact:hover .value {
    color: var(--accent);
  }
  @media (max-width: 760px) {
    .section {
      padding: 56px 0;
    }
    .two {
      grid-template-columns: 1fr;
    }
    .card {
      padding: 20px;
    }
    h2 {
      font-size: 28px;
      margin-bottom: 28px;
    }
  }
</style>
