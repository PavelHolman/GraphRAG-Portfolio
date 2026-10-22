<script lang="ts">
  // One route: the Hero (Scene, intro and the centred chat) and the Sections below it. docs/spec/page.md.
  import { Canvas } from '@threlte/core';
  import { flushSync, onMount, untrack } from 'svelte';
  import Scene from '$lib/scene/Scene.svelte';
  import type { SceneGraph } from '$lib/scene/types.ts';
  import Chat from '$lib/chat/Chat.svelte';
  import SelectionAsk from '$lib/chat/SelectionAsk.svelte';
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
  // The prompt field hides until the visitor asks to talk; any question asked anywhere opens it.
  let revealed = $state(false);
  let autofocus = $state(false);
  let askButton = $state<HTMLButtonElement | undefined>();
  // The intro's box and the column's landing position, measured while the intro is visible, so the
  // answer can take the intro's exact place and the prompt field never moves.
  let lead = $state<HTMLDivElement | undefined>();
  let introEl = $state<HTMLDivElement | undefined>();
  let introSlot = $state(0);
  let leadTop = $state(0);
  const measure = () => {
    const hero = document.getElementById('top');
    if (!lead || !introEl || !hero) return;
    if (introEl.offsetHeight > 0) introSlot = introEl.offsetHeight;
    leadTop = lead.getBoundingClientRect().top - hero.getBoundingClientRect().top;
  };
  // On phones the intro copy makes room for the caption once a conversation has started.
  const conversing = $derived(turn.messages.length > 0);
  const open = $derived(revealed || conversing);
  const hint = $derived(data.hints[hintIndex % Math.max(1, data.hints.length)]);
  // Hint preview: faint tier while a ghost hint shows and nothing streams or is typed.
  const preview = $derived(
    open && !typing && !turn.streaming && turn.subgraph === null && hint
      ? new Set(hint.candidates)
      : null,
  );

  const onsend = (p: string) => turn.run(p, 'typed');
  const onplayhint = () => {
    if (!hint) return;
    turn.run(hint.prompt, 'hint');
    hintIndex++;
  };
  const onfollowup = (p: string) => turn.run(p, 'followup');
  const onsendOrFollowup = (p: string) => (turn.followups.includes(p) ? onfollowup(p) : onsend(p));
  const oncite = (id: string, label: string) => {
    turn.focused = id;
    turn.focusedLabel = label;
    turn.focusTick++;
  };
  const oninput = (active: boolean) => {
    typing = active;
  };
  const onask = (prompt: string) => {
    autofocus = false;
    document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
    turn.run(prompt, 'hint');
  };
  const onclose = () => turn.reset();
  const onpick = (i: number) => {
    picked = i;
  };
  // The pick card links to the Node's card in the Sections (or the About section for the Person).
  const SECTIONED = new Set(['experience', 'education', 'project', 'skill']);
  const pickedNode = $derived(picked == null ? null : (graph.nodes[picked] ?? null));
  const pickHref = $derived(
    pickedNode === null
      ? null
      : pickedNode.type === 'person'
        ? '#about'
        : SECTIONED.has(pickedNode.type)
          ? `#${pickedNode.id}`
          : null,
  );
  const askPicked = () => {
    if (!pickedNode) return;
    const p =
      pickedNode.type === 'person'
        ? 'Give me a short overview of your career'
        : `Tell me about ${pickedNode.title}`;
    picked = null;
    onask(p);
  };
  // One view transition: the "Ask about me" pill grows into the prompt field (both are named
  // `ask`) and the other actions glide into its place. Without support, or with reduced motion,
  // the change is instant.
  // Resolves once the change is in the DOM (the animation may still be running).
  const morph = (change: () => void): Promise<void> => {
    if (reducedMotion || !document.startViewTransition) {
      change();
      return Promise.resolve();
    }
    return document.startViewTransition(() => {
      change();
      flushSync();
    }).updateCallbackDone;
  };
  // The answer later takes the intro's measured place, so measure the intro as it now stands
  // (without its actions row while open) and the field never jumps when the first answer arrives.
  const askIntro = () =>
    void morph(() => {
      revealed = true;
      autofocus = true;
    }).then(measure);
  // Keyboard focus returns to the button the field came from.
  const dismiss = () =>
    void morph(() => {
      revealed = false;
      autofocus = false;
      turn.reset();
    }).then(() => {
      measure();
      askButton?.focus({ preventScroll: true });
    });
  // A selected phrase is the visitor's own words, so it counts as typed, not as a suggestion.
  const askSelected = (prompt: string) => {
    document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' });
    turn.run(prompt, 'typed');
  };

  // JSON-LD Person for crawlers. The tag is assembled from pieces so linters that extract
  // <script> blocks from Svelte files do not mistake it for one.
  const jsonLd = $derived(
    `<${'script'} type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: data.model.person.name,
      jobTitle: data.model.person.headline,
      // Profiles only: the email and the site's own CV file are not other identities.
      sameAs: Object.values(data.model.person.links).filter((l) => /^https?:/.test(l)),
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
      if (turn.messages.length === 0) measure();
    };
    resize();
    requestAnimationFrame(measure);
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
  <!-- Link previews (LinkedIn, Slack, X): the Hero at rest, rendered by `bun content:render`. -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{data.origin}/" />
  <meta property="og:title" content="{data.model.person.name} · interactive resume" />
  <meta property="og:description" content={data.model.person.lede ?? ''} />
  <meta property="og:image" content="{data.origin}/hero.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta
    property="og:image:alt"
    content="{data.model.person.name}: {data.model.person.headline ?? ''}"
  />
  <meta name="twitter:card" content="summary_large_image" />
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
            focusTick={turn.focusTick}
            {portrait}
            lift={conversing && portrait}
            {onpick}
          />
        </Canvas>
      {/if}
    {:else}
      <div class="fallback" aria-hidden="true"></div>
    {/if}
  </div>

  <!-- Left column: the intro copy, replaced by the conversation once a question is asked. -->
  <div class="lead" class:conversing bind:this={lead} style:--lead-top="{leadTop}px">
    <div class="intro" class:aside={conversing} bind:this={introEl}>
      <h1>{data.model.person.name}</h1>
      {#if data.model.person.headline}<p class="headline">{data.model.person.headline}</p>{/if}
      {#if data.model.person.lede}<p class="lede">{data.model.person.lede}</p>{/if}
      <!-- While the field is open it takes this row's place; the header keeps Contact and the CV. -->
      {#if !open}
        <div class="actions">
          <button class="primary" bind:this={askButton} onclick={askIntro}>✦ Ask about me</button>
          {#if data.model.person.links.email}<a
              class="secondary"
              href={data.model.person.links.email}>Contact me</a
            >{/if}
          {#if data.model.person.links.cv}<a class="secondary" href={data.model.person.links.cv}
              >Download CV</a
            >{/if}
        </div>
      {/if}
    </div>

    <Chat
      messages={turn.messages}
      followups={turn.followups}
      hint={hint?.prompt ?? ''}
      streaming={turn.streaming}
      focused={turn.focused}
      onsend={onsendOrFollowup}
      {onplayhint}
      {oncite}
      {oninput}
      {onclose}
      slotHeight={introSlot}
      {open}
      {autofocus}
      ondismiss={dismiss}
    />
  </div>

  {#if pickedNode}
    <aside class="pick">
      <button class="close" aria-label="close" onclick={() => (picked = null)}>×</button>
      <span class="type">{pickedNode.type}</span>
      <b>{pickedNode.title}</b>
      {#if pickedNode.summary}<p>{pickedNode.summary}</p>{/if}
      <div class="pick-actions">
        <button class="act" onclick={askPicked}>✦ ask about this</button>
        {#if pickHref}<a class="act" href={pickHref} onclick={() => (picked = null)}
            >→ in the resume</a
          >{/if}
      </div>
    </aside>
  {/if}
  {#if data.embeddingModel.startsWith('local-')}
    <div class="notice">
      artifact built with the local embedder; run content:index with a Workers AI token
    </div>
  {/if}
</section>

<main>
  <Sections model={data.model} {onask} />
</main>

<SelectionAsk onask={askSelected} />

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
  /* The left column: intro copy with the prompt field under it, beside the constellation.
     Once a question is asked the answer takes the intro's place; the stars stay uncovered. */
  .lead {
    position: absolute;
    left: max(20px, calc((100% - 1024px) / 2 + 16px));
    top: 50%;
    transform: translateY(-50%);
    width: min(520px, 46vw);
    display: grid;
    /* No gap: the prompt field opens exactly where the actions row was, centred on the same line. */
    gap: 0;
    z-index: 5;
    /* The column is transparent to the pointer so stars behind it stay hoverable and clickable;
       only the controls take events back. */
    pointer-events: none;
  }
  /* With a question open the column is anchored at the top, so the streaming answer only grows
     downward and the text already read never moves. */
  .lead.conversing {
    top: var(--lead-top);
    transform: none;
  }
  .intro {
    /* Glides as one piece when the field opens below it, instead of cross-fading in two places. */
    view-transition-name: intro;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  .actions > * {
    pointer-events: auto;
  }
  .intro.aside {
    display: none;
  }
  @media (max-width: 760px) {
    /* Phones: the intro sits at the top, the chat sheet at the bottom of the Hero. */
    .lead,
    .lead.conversing {
      position: static;
      transform: none;
      width: auto;
      display: block;
    }
    .intro {
      position: absolute;
      left: 16px;
      right: 16px;
      top: 14vh;
      z-index: 5;
    }
    .intro.aside {
      display: block;
      opacity: 0;
      pointer-events: none;
    }
    .intro.aside > * {
      pointer-events: none;
    }
  }
  h1 {
    font:
      600 clamp(40px, 6vw, 68px) / 1.02 'Bricolage Grotesque',
      sans-serif;
    margin: 0 0 10px;
    letter-spacing: -0.01em;
    color: var(--fg);
  }
  .headline {
    font:
      400 clamp(18px, 2.2vw, 26px) / 1.3 'DM Sans',
      sans-serif;
    color: var(--fg-muted);
    margin: 0 0 18px;
  }
  .lede {
    font-size: 17px;
    line-height: 1.55;
    margin: 0 0 24px;
    color: var(--fg);
    max-width: 460px;
  }
  /* One line, and as tall as the prompt field (50px) with the buttons centred in it, so opening
     the field in this row's place moves nothing and the pill morphs about one shared centre. */
  .actions {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    min-height: 50px;
    gap: 10px;
  }
  /* Narrow columns and phones: a little tighter so the three still fit on one line. */
  @media (max-width: 900px) {
    .actions {
      gap: 8px;
    }
    .intro .actions .primary,
    .intro .actions .secondary {
      padding: 9px 14px;
      font-size: 13px;
    }
  }
  @media (max-width: 400px) {
    .actions {
      gap: 6px;
    }
    .intro .actions .primary,
    .intro .actions .secondary {
      padding: 8px 11px;
      font-size: 12px;
    }
  }
  /* The very narrowest phones (320px) cannot fit three readable buttons; wrapping beats clipping. */
  @media (max-width: 340px) {
    .actions {
      flex-wrap: wrap;
    }
  }
  .actions .primary,
  .actions .secondary {
    white-space: nowrap;
    border-radius: 999px;
    padding: 10px 18px;
    font:
      500 14px 'DM Sans',
      sans-serif;
    text-decoration: none;
    cursor: pointer;
  }
  .actions .primary {
    view-transition-name: ask;
    background: var(--accent);
    color: var(--bg);
    border: 1px solid var(--accent);
  }
  /* Keyboard focus (closing the field hands it back here) in the page's own colours. */
  .actions .primary:focus-visible,
  .actions .secondary:focus-visible {
    outline: 2px solid var(--fg);
    outline-offset: 2px;
  }
  .actions .secondary {
    background: rgba(15, 14, 13, 0.6);
    color: var(--fg);
    border: 1px solid var(--line);
    backdrop-filter: blur(8px);
  }
  .actions .secondary:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  /* The morph: the button stretches in place into the field, both images pinned left and clipped
     to the group's rounded box so neither text squashes. */
  :global(::view-transition-group(ask)) {
    overflow: clip;
    border-radius: 999px;
    animation-duration: 0.42s;
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }
  :global(::view-transition-old(ask)),
  :global(::view-transition-new(ask)) {
    height: 100%;
    object-fit: none;
    object-position: left center;
  }
  :global(::view-transition-old(ask)) {
    animation-duration: 0.18s;
  }
  /* Contact and the CV need no names: they leave with the page cross-fade. Named, Chrome would
     copy their backdrop blur onto a transition group that smears the field for the whole morph. */
  :global(::view-transition-group(intro)) {
    animation-duration: 0.42s;
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }
  .pick {
    position: absolute;
    right: 12px;
    top: max(64px, calc(env(safe-area-inset-top) + 64px));
    width: min(300px, calc(100vw - 24px));
    display: grid;
    gap: 6px;
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--panel);
    border: 1px solid var(--line);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
    z-index: 6;
  }
  .pick .close {
    position: absolute;
    top: 6px;
    right: 8px;
    background: none;
    border: 0;
    color: var(--fg-muted);
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
    padding: 4px 6px;
  }
  .pick .close:hover {
    color: var(--accent);
  }
  .pick p {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--fg-muted);
  }
  .pick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .pick .act {
    background: none;
    border: 1px solid var(--line);
    color: var(--fg);
    border-radius: 999px;
    padding: 6px 12px;
    font:
      12px 'DM Sans',
      sans-serif;
    text-decoration: none;
    cursor: pointer;
  }
  .pick .act:hover {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-soft);
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
    right: 12px;
    bottom: 12px;
    font:
      10px/1.4 'Azeret Mono',
      monospace;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted);
    max-width: 240px;
    text-align: right;
    z-index: 5;
  }
  main {
    position: relative;
  }
  @media (max-width: 760px) {
    .lede {
      font-size: 15px;
    }
  }
</style>
