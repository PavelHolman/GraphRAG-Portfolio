<script lang="ts">
  // One route: the Hero (Scene + centred chat) and the Sections below it. docs/spec/page.md.
  import { Canvas } from '@threlte/core';
  import { onMount, untrack } from 'svelte';
  import Scene from '$lib/scene/Scene.svelte';
  import type { SceneGraph } from '$lib/scene/types.ts';
  import Chat from '$lib/chat/Chat.svelte';
  import { TurnState } from '$lib/chat/turn-state.svelte.ts';
  import Sections from '$lib/sections/Sections.svelte';
  import Header from '$lib/sections/Header.svelte';

  let { data } = $props();
  // The artifact is fixed for the life of the page; capture it once.
  const graph: SceneGraph = untrack(() => ({
    nodes: data.scene.nodes,
    edges: data.scene.edges,
    positions: Float32Array.from(data.scene.positions),
    person: data.scene.person,
  }));
  const turn = new TurnState(graph);

  let hintIndex = $state(0);
  let typing = $state(false);
  let portrait = $state(false);
  let scrolled = $state(false);
  let heroVisible = $state(true);
  let webgl = $state(true);
  let reducedMotion = $state(false);
  let picked = $state<number | null>(null);
  const hint = $derived(data.hints[hintIndex % Math.max(1, data.hints.length)]);
  // Hint preview: faint tier while a ghost hint shows and nothing streams or is typed.
  const preview = $derived(
    !typing && !turn.streaming && turn.subgraph === null && hint ? new Set(hint.candidates) : null,
  );

  const onsend = (p: string) => turn.run(p, 'typed');
  const onplayhint = () => {
    if (!hint) return;
    turn.run(hint.prompt, 'hint');
    hintIndex++;
  };
  const onfollowup = (p: string) => turn.run(p, 'followup');
  const oncite = (id: string) => {
    turn.focused = id;
  };
  const oninput = (active: boolean) => {
    typing = active;
  };
  const onask = (prompt: string) => {
    document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
    turn.run(prompt, 'hint');
  };
  const onpick = (i: number) => {
    picked = i;
  };

  // JSON-LD Person for crawlers. The tag is assembled from pieces so linters that extract
  // <script> blocks from Svelte files do not mistake it for one.
  const jsonLd = $derived(
    `<${'script'} type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: data.model.person.name,
      sameAs: Object.values(data.model.person.links).filter((l) => !l.startsWith('mailto:')),
      knowsAbout: data.model.skills.flatMap((g) => g.skills.map((s) => s.title)).slice(0, 12),
      worksFor: data.model.experience[0]?.organization
        ? { '@type': 'Organization', name: data.model.experience[0].organization }
        : undefined,
      alumniOf: data.model.education
        .map((e) => e.organization)
        .filter(Boolean)
        .map((name) => ({ '@type': 'Organization', name })),
    })}</${'script'}>`,
  );

  onMount(() => {
    const canvas = document.createElement('canvas');
    webgl = Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => {
      portrait = window.innerWidth < window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    const cycle = setInterval(() => {
      if (!turn.streaming && !typing) hintIndex++;
    }, 6000);
    const onScroll = () => {
      scrolled = window.scrollY > window.innerHeight * 0.8;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const hero = document.getElementById('top');
    const io = hero
      ? new IntersectionObserver(([e]) => (heroVisible = e?.isIntersecting ?? true))
      : null;
    if (hero) io?.observe(hero);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', onScroll);
      clearInterval(cycle);
      io?.disconnect();
    };
  });
</script>

<svelte:head>
  <title>{data.model.person.name} · interactive resume</title>
  <meta name="description" content={data.model.person.lede ?? ''} />
  {@html jsonLd}
</svelte:head>

<Header name={data.model.person.name} links={data.model.person.links} {scrolled} />

<section id="top" class="hero">
  <div class="stage">
    {#if webgl && !reducedMotion}
      {#if heroVisible}
        <Canvas dpr={[1, 2]} renderMode="on-demand" shadows={false}>
          <Scene
            {graph}
            subgraph={turn.subgraph}
            {preview}
            focus={turn.focusNodeIndex()}
            {portrait}
            {onpick}
          />
        </Canvas>
      {/if}
    {:else}
      <div class="fallback" aria-hidden="true"></div>
    {/if}
  </div>
  {#if picked != null}
    <aside class="pick">
      <span class="type">{graph.nodes[picked]?.type}</span><b>{graph.nodes[picked]?.title}</b>
    </aside>
  {/if}
  {#if data.embeddingModel.startsWith('local-')}
    <div class="notice">
      artifact built with the local embedder; run content:index with a Workers AI token
    </div>
  {/if}
  <Chat
    messages={turn.messages}
    followups={turn.followups}
    hint={hint?.prompt ?? ''}
    streaming={turn.streaming}
    focused={turn.focused}
    onsend={(p) => (turn.followups.includes(p) ? onfollowup(p) : onsend(p))}
    {onplayhint}
    {oncite}
    {oninput}
  />
</section>

<main>
  <Sections model={data.model} {onask} />
</main>

<style>
  .hero {
    position: relative;
    height: 100svh;
    overflow: hidden;
    background: radial-gradient(
      90% 60% at 50% 0%,
      var(--bg-soft) 0%,
      var(--bg) 60%,
      var(--panel) 100%
    );
  }
  .stage {
    position: absolute;
    inset: 0;
    touch-action: none;
  }
  .fallback {
    position: absolute;
    inset: 0;
    background: radial-gradient(40% 40% at 50% 45%, rgba(255, 138, 114, 0.12), transparent);
  }
  .pick {
    position: absolute;
    right: 12px;
    top: max(56px, calc(env(safe-area-inset-top) + 56px));
    display: grid;
    gap: 2px;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--panel);
    border: 1px solid var(--line);
    z-index: 5;
  }
  .pick .type {
    font:
      10px/1 'Azeret Mono',
      monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .pick b {
    font:
      600 15px/1.2 'Bricolage Grotesque',
      sans-serif;
  }
  .notice {
    position: absolute;
    left: 12px;
    top: max(56px, calc(env(safe-area-inset-top) + 56px));
    font:
      10px/1.4 'Azeret Mono',
      monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted);
    max-width: 240px;
    z-index: 5;
  }
  main {
    position: relative;
    background: var(--bg);
  }
</style>
