<script lang="ts">
  // About, Experience, Education, Skills, Contact: server-rendered from the artifact. docs/spec/page.md.
  import type { PageModel } from './model.ts';
  interface Props {
    model: PageModel;
    onask: (prompt: string) => void;
  }
  let { model, onask }: Props = $props();
  const paragraphs = (body: string) => body.split(/\n\s*\n/).filter((p) => p.trim());
  const ask = (prompt: string) => () => onask(prompt);
  const linkLabel = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
</script>

<section id="about" class="section">
  <h2>About</h2>
  {#if model.person.lede}<p class="lede">{model.person.lede}</p>{/if}
  {#each paragraphs(model.person.body) as p (p)}<p>{p}</p>{/each}
  {#if model.person.location}<p class="meta">{model.person.location}</p>{/if}
</section>

<section id="experience" class="section">
  <h2>Experience</h2>
  {#each model.experience as x (x.id)}
    <article>
      <header>
        <h3>{x.role ?? x.title}</h3>
        <p class="meta">{x.organization ?? ''}{x.organization && x.range ? ' · ' : ''}{x.range}</p>
      </header>
      {#each paragraphs(x.body) as p (p)}<p>{p}</p>{/each}
      {#if x.skills.length}
        <ul class="chips">
          {#each x.skills as s (s.title)}<li title={s.note ?? ''}>{s.title}</li>{/each}
        </ul>
      {/if}
      {#if x.projects.length}
        <ul class="projects">
          {#each x.projects as p (p.id)}
            <li>
              <b>{p.title}</b>{#if p.led}<span class="tag">led</span>{/if}{#if p.summary}<span>
                  — {p.summary}</span
                >{/if}
            </li>
          {/each}
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
</section>

{#if model.education.length}
  <section id="education" class="section">
    <h2>Education</h2>
    {#each model.education as e (e.id)}
      <article>
        <header>
          <h3>{[e.degree, e.field].filter(Boolean).join(' in ') || e.title}</h3>
          <p class="meta">
            {e.organization ?? ''}{e.organization && e.range ? ' · ' : ''}{e.range}
          </p>
        </header>
        {#each paragraphs(e.body) as p (p)}<p>{p}</p>{/each}
        <button class="ask" onclick={ask(`Tell me about your ${e.title}`)}>✦ ask about this</button>
      </article>
    {/each}
  </section>
{/if}

<section id="skills" class="section">
  <h2>Skills</h2>
  {#each model.skills as g (g.category)}
    <h3 class="cat">{g.category}</h3>
    <ul class="skills">
      {#each g.skills as s (s.id)}
        <li>
          <button class="skill" onclick={ask(`Tell me about your ${s.title} work`)}>
            <b>{s.title}</b>{#if s.span}<span class="meta">{s.span}</span>{/if}
            {#if s.summary}<span class="sum">{s.summary}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/each}
</section>

<section id="contact" class="section">
  <h2>Contact</h2>
  <ul class="links">
    {#each Object.entries(model.person.links) as [k, href] (k)}
      <li>
        <a {href} rel="me noopener" target={href.startsWith('mailto:') ? undefined : '_blank'}
          >{linkLabel(k)}</a
        >
      </li>
    {/each}
  </ul>
</section>

<style>
  .section {
    max-width: 680px;
    margin: 0 auto;
    padding: 56px 16px;
    border-top: 1px solid var(--line);
  }
  h2 {
    font:
      10px/1 'Azeret Mono',
      monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--fg-muted);
    margin: 0 0 24px;
  }
  h3 {
    font:
      600 22px/1.2 'Bricolage Grotesque',
      sans-serif;
    margin: 0 0 4px;
  }
  .cat {
    font:
      600 15px/1.2 'Bricolage Grotesque',
      sans-serif;
    margin: 24px 0 10px;
    text-transform: capitalize;
  }
  article {
    margin-bottom: 40px;
  }
  p {
    margin: 0 0 12px;
    line-height: 1.65;
  }
  .lede {
    font-size: 19px;
    line-height: 1.5;
  }
  .meta {
    font:
      11px/1.6 'Azeret Mono',
      monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0 0 12px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chips li {
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 12px;
    color: var(--fg-muted);
  }
  .projects li {
    padding: 6px 0;
    border-top: 1px solid var(--line);
    font-size: 14px;
  }
  .tag {
    margin-left: 8px;
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
    padding: 5px 12px;
    font:
      12px 'DM Sans',
      sans-serif;
    cursor: pointer;
  }
  .ask:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  .skills {
    display: grid;
    gap: 6px;
  }
  .skill {
    width: 100%;
    text-align: left;
    background: var(--bg-soft);
    border: 1px solid var(--line);
    color: var(--fg);
    border-radius: 12px;
    padding: 10px 14px;
    display: grid;
    gap: 2px;
    font:
      14px 'DM Sans',
      sans-serif;
    cursor: pointer;
  }
  .skill:hover {
    border-color: var(--accent);
  }
  .sum {
    color: var(--fg-muted);
    font-size: 13px;
  }
  .links {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .links a {
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 8px 16px;
    color: var(--fg);
    text-decoration: none;
  }
  .links a:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
