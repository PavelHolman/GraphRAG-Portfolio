<script lang="ts">
  // Sticky header: name left, anchors centre, links and the CV button right. Frosted glass the
  // whole way down, deepening once the Hero is scrolled past. docs/spec/page.md.
  import Icon from './Icon.svelte';
  interface Props {
    name: string;
    links: Record<string, string>;
    scrolled: boolean;
  }
  let { name, links, scrolled }: Props = $props();
  const anchors = ['about', 'experience', 'education', 'projects', 'skills', 'contact'];
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
        aria-label={k}><Icon name={k} size={15} /></a
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
    /* Glass over the Hero too: the stars and the intro copy stay visible through it, but the
       anchors and icons keep their contrast. */
    background: rgba(15, 14, 13, 0.5);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    border-bottom: 1px solid rgba(241, 239, 233, 0.07);
    transition:
      background 0.3s,
      border-color 0.3s;
  }
  .top.scrolled {
    background: rgba(15, 14, 13, 0.8);
    border-bottom-color: var(--line);
  }
  .name {
    font:
      600 16px 'Bricolage Grotesque',
      sans-serif;
    color: var(--fg);
    text-decoration: none;
    white-space: nowrap;
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    color: var(--fg);
    text-decoration: none;
    border: 1px solid var(--line);
    border-radius: 999px;
  }
  .links a:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .links .cta {
    width: auto;
    height: auto;
    font:
      500 12px 'DM Sans',
      sans-serif;
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
    padding: 8px 14px;
    margin-left: 6px;
    /* Never "Download / CV" on two lines when the header gets tight. */
    white-space: nowrap;
    flex: none;
  }
  .links .cta:hover {
    color: var(--bg);
    filter: brightness(1.08);
  }
  /* Tablets and narrow laptops: the section anchors step aside so the name and links stay on
     one line each. */
  @media (max-width: 960px) {
    .anchors {
      display: none;
    }
    .top {
      grid-template-columns: auto 1fr;
    }
  }
  @media (max-width: 760px) {
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
