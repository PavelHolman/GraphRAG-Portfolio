<script lang="ts">
  // Select any text in the page and a pill appears just off the end of the selection, offering to
  // ask about it, so a reader can dig into a phrase a card or an Answer mentions without retyping
  // it. Below and right of the selection's last line: that is where the browser's own selection
  // menu is not. docs/spec/page.md.
  import { onMount } from 'svelte';
  interface Props {
    /** Runs the selected text as a Prompt. */
    onask: (prompt: string) => void;
  }
  let { onask }: Props = $props();
  /** Below this a selection is an accident; above it, a paragraph rather than a question. */
  const MIN_CHARS = 3;
  const MAX_CHARS = 200;
  /** Gap between the selection and the pill, and the smallest margin to a viewport edge. */
  const GAP = 8;
  const EDGE = 12;

  let text = $state('');
  /** The selection's bottom-right corner, in viewport coordinates. */
  let corner = $state<{ x: number; y: number } | null>(null);
  /** An accent bar at each end of the selection, so its extent reads at a glance. */
  let bars = $state<Array<{ x: number; y: number; h: number }>>([]);
  let pillWidth = $state(0);
  let pillHeight = $state(0);
  let viewportWidth = $state(0);
  let viewportHeight = $state(0);
  // Clamped so a selection at the edge of the window still shows the whole pill.
  const left = $derived(Math.max(EDGE, Math.min(corner?.x ?? 0, viewportWidth - pillWidth - EDGE)));
  const top = $derived(
    Math.max(EDGE, Math.min(corner?.y ?? 0, viewportHeight - pillHeight - EDGE)),
  );

  /** Page content only: never the sticky header, the Scene's pick card or a form field. */
  const inContent = (n: Node | null): boolean => {
    const el = n instanceof Element ? n : (n?.parentElement ?? null);
    if (!el || el.closest('input, textarea, header, .pick')) return false;
    return Boolean(el.closest('#top, main'));
  };

  const clear = () => {
    text = '';
    corner = null;
    bars = [];
  };

  const read = () => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return clear();
    const picked = sel.toString().replace(/\s+/g, ' ').trim();
    if (picked.length < MIN_CHARS || picked.length > MAX_CHARS) return clear();
    if (!inContent(sel.anchorNode) || !inContent(sel.focusNode)) return clear();
    // The last client rect is the selection's final line, so the pill lands where the text ends
    // rather than at the right edge of the widest line.
    const rects = sel.getRangeAt(0).getClientRects();
    const first = rects[0];
    const last = rects[rects.length - 1];
    if (!first || !last || (!last.width && !last.height)) return clear();
    text = picked;
    corner = { x: last.right, y: last.bottom + GAP };
    bars = [
      { x: first.left, y: first.top, h: first.height },
      { x: last.right, y: last.top, h: last.height },
    ];
  };

  // `selectionchange` fires on every pointer move through a drag; one read per frame is plenty.
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      read();
    });
  };

  onMount(() => {
    document.addEventListener('selectionchange', schedule);
    return () => document.removeEventListener('selectionchange', schedule);
  });
</script>

<svelte:window
  bind:innerWidth={viewportWidth}
  bind:innerHeight={viewportHeight}
  onscroll={schedule}
  onresize={schedule}
/>

{#each bars as b, i (i)}
  <span
    class="bar"
    aria-hidden="true"
    style:transform="translate3d({b.x}px, {b.y}px, 0)"
    style:height="{b.h}px"
  ></span>
{/each}

{#if text && corner}
  <button
    class="pill"
    bind:clientWidth={pillWidth}
    bind:clientHeight={pillHeight}
    style:transform="translate3d({left}px, {top}px, 0)"
    title="Ask about the selected text"
    onmousedown={(e) => e.preventDefault()}
    onclick={() => {
      const prompt = text;
      document.getSelection()?.removeAllRanges();
      clear();
      onask(prompt);
    }}>✦ ask about this</button
  >
{/if}

<style>
  .bar {
    position: fixed;
    top: 0;
    left: 0;
    width: 2px;
    border-radius: 1px;
    background: var(--accent);
    box-shadow: 0 0 8px rgba(255, 138, 114, 0.6);
    pointer-events: none;
    z-index: 39;
    will-change: transform;
    /* Follows the drag instead of snapping to each new rect. */
    transition:
      transform 0.12s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.12s ease;
    animation: appear 0.15s ease;
  }
  .pill {
    position: fixed;
    top: 0;
    left: 0;
    /* Over the sticky header, which sits at 30. */
    z-index: 40;
    will-change: transform;
    transition: transform 0.14s cubic-bezier(0.22, 1, 0.36, 1);
    white-space: nowrap;
    background: var(--panel);
    border: 1px solid var(--accent);
    border-radius: 999px;
    padding: 6px 13px;
    color: var(--fg);
    font:
      12px 'DM Sans',
      sans-serif;
    cursor: pointer;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: appear 0.15s ease;
  }
  .pill:hover {
    background: var(--accent-soft);
  }
  @keyframes appear {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bar,
    .pill {
      animation: none;
      transition: none;
    }
  }
</style>
