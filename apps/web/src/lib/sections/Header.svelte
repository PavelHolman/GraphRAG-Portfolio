<script lang="ts">
  // Sticky header: name left, anchors centre, links and the CV button right; translucent over the
  // Hero, opaque once scrolled past it. docs/spec/page.md.
  interface Props {
    name: string;
    links: Record<string, string>;
    scrolled: boolean;
  }
  let { name, links, scrolled }: Props = $props();
  const anchors = ['about', 'experience', 'education', 'skills', 'contact'];
  const icon: Record<string, string> = { github: 'GH', linkedin: 'in', email: '@' };
  const initials = $derived(
    name
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .join('')
      .slice(0, 3)
      .toUpperCase(),
  );
  const iconLinks = $derived(Object.entries(links).filter(([k]) => k !== 'cv'));
</script>

<header class="top" class:scrolled>
  <a class="name" href="#top"
    ><span class="initials">{initials}</span><span class="full">{name}</span></a
  >
  <nav class="anchors">
    {#each anchors as a (a)}<a href={'#' + a}>{a}</a>{/each}
  </nav>
  <nav class="links">
    {#each iconLinks as [k, href] (k)}
      <a
        {href}
        target={href.startsWith('mailto:') ? undefined : '_blank'}
        rel="me noopener"
        aria-label={k}>{icon[k] ?? k}</a
      >
    {/each}
    {#if links.cv}<a class="cta" href={links.cv} target="_blank" rel="noopener">Download CV</a>{/if}
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
    padding: max(12px, env(safe-area-inset-top)) 20px 12px;
    transition:
      background 0.3s,
      border-color 0.3s;
    border-bottom: 1px solid transparent;
  }
  .top.scrolled {
    background: rgba(15, 14, 13, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom-color: var(--line);
  }
  .name {
    font:
      600 16px 'Bricolage Grotesque',
      sans-serif;
    color: var(--fg);
    text-decoration: none;
  }
  .initials {
    display: none;
  }
  .anchors {
    display: flex;
    gap: 18px;
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
    align-items: center;
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
    padding: 8px 10px;
  }
  .links a:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .links .cta {
    font:
      500 12px 'DM Sans',
      sans-serif;
    letter-spacing: 0;
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
    padding: 8px 14px;
    margin-left: 6px;
  }
  .links .cta:hover {
    color: var(--bg);
    filter: brightness(1.08);
  }
  @media (max-width: 760px) {
    .anchors {
      display: none;
    }
    .initials {
      display: inline;
    }
    .full {
      display: none;
    }
    .top {
      grid-template-columns: auto 1fr;
    }
  }
</style>
