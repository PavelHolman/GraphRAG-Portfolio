<script lang="ts">
  // About, Experience, Education, Skills, Contact: server-rendered from the artifact, in a single
  // centred column with big section titles, alternating backgrounds and soft cards. docs/spec/page.md.
  import type { PageModel } from './model.ts';
  import Icon from './Icon.svelte';
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
  // Contact cards show the handle, not the URL; LinkedIn slugs are noise, so the name stands in.
  const handle = (k: string, href: string) => {
    if (href.startsWith('mailto:')) return href.slice(7);
    if (k === 'linkedin') return model.person.name;
    return href.replace(/\/$/, '').split('/').pop() ?? href;
  };
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
      <aside class="card facts askable">
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
          {#if model.person.availability}<dt>Open to</dt>
            <dd>{model.person.availability}</dd>{/if}
          {#each Object.entries(model.person.languages) as [lang, level] (lang)}
            <dt>{lang}</dt>
            <dd>{level}</dd>
          {/each}
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
        <article class="card askable" id={x.id}>
          <header>
            <h3>{x.role ?? x.title}</h3>
            <p class="meta">
              {#if x.organizationUrl}<a
                  class="org"
                  href={x.organizationUrl}
                  target="_blank"
                  rel="noopener">{x.organization ?? ''}</a
                >{:else}<span class="org">{x.organization ?? ''}</span
                >{/if}{#if x.organization && x.range}<span class="sep">·</span>{/if}<span
                >{x.range}</span
              >
            </p>
          </header>
          {#each paragraphs(x.body) as p (p)}<p>{p}</p>{/each}
          {#if x.projects.length}
            <ul class="projects">
              {#each x.projects as p (p.id)}
                <li>
                  {#if p.url}<a class="ext" href={p.url} target="_blank" rel="noopener"
                      ><b>{p.title}</b><Icon name="link" size={11} /></a
                    >{:else}<b>{p.title}</b>{/if}{#if p.led}<span class="tag">led</span>{/if}
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
          <article class="card askable" id={e.id}>
            <header>
              <h3>{[e.degree, e.field].filter(Boolean).join(' in ') || e.title}</h3>
              <p class="meta">
                <span class="org">{e.organization ?? ''}</span>{#if e.organization && e.range}<span
                    class="sep">·</span
                  >{/if}<span>{e.range}</span>
              </p>
            </header>
            {#each paragraphs(e.body) as p (p)}<p>{p}</p>{/each}
            {#if e.projects.length}
              <ul class="projects">
                {#each e.projects as p (p.id)}
                  <li>
                    {#if p.url}<a class="ext" href={p.url} target="_blank" rel="noopener"
                        ><b>{p.title}</b><Icon name="link" size={11} /></a
                      >{:else}<b>{p.title}</b>{/if}
                    {#if p.summary}<span class="sum">{p.summary}</span>{/if}
                  </li>
                {/each}
              </ul>
            {/if}
            <button class="ask" onclick={ask(`Tell me about your ${e.title}`)}
              >✦ ask about this</button
            >
          </article>
        {/each}
      </div>
    </div>
  </section>
{/if}

{#if model.projects.length}
  <section id="projects" class="section alt">
    <div class="container">
      <h2>Projects</h2>
      <div class="stack">
        {#each model.projects as p (p.id)}
          <article class="card askable" id={p.id}>
            <header>
              <h3>{p.title}</h3>
              <p class="meta">
                {#if p.range}<span>{p.range}</span>{/if}
                {#if p.url}<a
                    class="iconbtn"
                    href={p.url}
                    target="_blank"
                    rel="noopener"
                    aria-label="website"
                    title={linkValue(p.url)}><Icon name="link" size={13} /></a
                  >{/if}
                {#if p.repo}<a
                    class="iconbtn"
                    href={p.repo}
                    target="_blank"
                    rel="noopener"
                    aria-label="repository"
                    title={linkValue(p.repo)}><Icon name="github" size={13} /></a
                  >{/if}
              </p>
            </header>
            {#each paragraphs(p.body) as t (t)}<p>{t}</p>{/each}
            {#if p.skills.length}
              <ul class="chips">
                {#each p.skills as s (s)}<li>{s}</li>{/each}
              </ul>
            {/if}
            <button class="ask" onclick={ask(`Tell me about ${p.title}`)}>✦ ask about this</button>
          </article>
        {/each}
      </div>
    </div>
  </section>
{/if}

<section id="skills" class="section">
  <div class="container">
    <h2>Skills</h2>
    <div class="grid">
      {#each model.skills as g (g.category)}
        <article class="card">
          <h3 class="cat">{g.category}</h3>
          <ul class="chips uniform">
            {#each g.skills as s (s.id)}
              <li id={s.id}>
                <button
                  class="chip"
                  title={s.summary ?? ''}
                  onclick={ask(`Tell me about your ${s.title} work`)}
                  ><span class="title">{s.title}</span></button
                >
              </li>
            {/each}
          </ul>
        </article>
      {/each}
    </div>
  </div>
</section>

<section id="contact" class="section alt">
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
          <span class="label"><Icon name={k} size={14} />{linkLabel(k)}</span>
          <span class="value">{handle(k, href)}</span>
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
  .card,
  .chips li {
    scroll-margin-top: 80px;
  }
  /* The card or chip a Scene pick linked to. */
  .card:target,
  .chips li:target {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .card {
    position: relative;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 28px;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
  }
  /* Cards with an "ask" affordance keep it in the top-right corner, clear of the title. */
  .askable > header,
  .askable > h3 {
    padding-right: 170px;
  }
  .askable > .ask {
    position: absolute;
    top: 22px;
    right: 22px;
    margin: 0;
  }
  @media (max-width: 600px) {
    .askable > header,
    .askable > h3 {
      padding-right: 0;
    }
    .askable > .ask {
      position: static;
      margin-top: 6px;
    }
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
    align-items: center;
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
    text-decoration: none;
  }
  a.org:hover {
    color: var(--accent);
  }
  .iconbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin: -3px 0;
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--fg);
  }
  .iconbtn:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  .ext {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--fg);
    text-decoration: none;
  }
  .ext:hover {
    color: var(--accent);
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
  /* Skills: every chip the same size, one per grid cell, titles wrapping to at most two lines. */
  .chips.uniform {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .chips.uniform li {
    display: grid;
    border-radius: 12px;
  }
  .chips.uniform .chip {
    width: 100%;
    min-height: 44px;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    text-align: center;
    line-height: 1.25;
  }
  .chips.uniform .title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
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
    display: inline-flex;
    align-items: center;
    gap: 8px;
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
