<script lang="ts">
  // Sticky header: name left, anchors centre, links right; translucent over the Hero. docs/spec/page.md.
  interface Props {
    name: string;
    links: Record<string, string>;
    scrolled: boolean;
  }
  let { name, links, scrolled }: Props = $props();
  const anchors = ['about', 'experience', 'education', 'skills', 'contact'];
  const icon: Record<string, string> = { github: 'GH', linkedin: 'in', email: '@', cv: 'CV' };
</script>

<header class="top" class:scrolled>
  <a class="name" href="#top">{name}</a>
  <nav class="anchors">
    {#each anchors as a (a)}<a href={'#' + a}>{a}</a>{/each}
  </nav>
  <nav class="links">
    {#each Object.entries(links) as [k, href] (k)}
      <a
        {href}
        target={href.startsWith('mailto:') ? undefined : '_blank'}
        rel="me noopener"
        aria-label={k}>{icon[k] ?? k}</a
      >
    {/each}
  </nav>
</header>

<style>
  .top {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 30;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    padding: max(10px, env(safe-area-inset-top)) 16px 10px;
    transition: background 0.3s;
  }
  .top.scrolled {
    background: var(--panel);
    border-bottom: 1px solid var(--line);
  }
  .name {
    font:
      600 15px 'Bricolage Grotesque',
      sans-serif;
    color: var(--fg);
    text-decoration: none;
  }
  .anchors {
    display: flex;
    gap: 14px;
  }
  .anchors a {
    font:
      10px/1 'Azeret Mono',
      monospace;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--fg-muted);
    text-decoration: none;
  }
  .anchors a:hover {
    color: var(--accent);
  }
  .links {
    display: flex;
    justify-content: end;
    gap: 6px;
  }
  .links a {
    font:
      10px/1 'Azeret Mono',
      monospace;
    letter-spacing: 0.08em;
    color: var(--fg);
    text-decoration: none;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 7px 9px;
  }
  .links a:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  @media (max-width: 700px) {
    .anchors {
      display: none;
    }
  }
</style>
