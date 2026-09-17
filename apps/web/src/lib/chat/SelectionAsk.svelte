<script lang="ts">
  // Select any text in the page and a pill offers to ask about it, so a reader can dig into a
  // phrase a card or an Answer mentions without retyping it. docs/spec/page.md.
  import { onMount } from 'svelte';
  interface Props {
    /** Runs the selected text as a Prompt. */
    onask: (prompt: string) => void;
  }
  let { onask }: Props = $props();
  /** Below this a selection is an accident; above it, a paragraph rather than a question. */
  const MIN_CHARS = 3;
  const MAX_CHARS = 200;
  /** Gap between the selection box and the pill. */
  const GAP = 10;

  let text = $state('');
  let spot = $state<{ x: number; y: number; below: boolean } | null>(null);

  /** Page content only: never the sticky header, the Scene's pick card or a form field. */
  const inContent = (n: Node | null): boolean => {
    const el = n instanceof Element ? n : (n?.parentElement ?? null);
    if (!el || el.closest('input, textarea, header, .pick')) return false;
    return Boolean(el.closest('#top, main'));
  };

  const clear = () => {
    text = '';
    spot = null;
  };

  const read = () => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return clear();
    const picked = sel.toString().replace(/\s+/g, ' ').trim();
    if (picked.length < MIN_CHARS || picked.length > MAX_CHARS) return clear();
    if (!inContent(sel.anchorNode) || !inContent(sel.focusNode)) return clear();
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r.width && !r.height) return clear();
    // Above the selection, unless the sticky header would eat it.
    const below = r.top < 90;
    text = picked;
    spot = {
      x: Math.min(Math.max(r.left + r.width / 2, 80), window.innerWidth - 80),
      y: below ? r.bottom + GAP : r.top - GAP,
      below,
    };
  };

  const ask = () => {
    const prompt = text;
    document.getSelection()?.removeAllRanges();
    clear();
    onask(prompt);
  };

  onMount(() => {
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
    document.addEventListener('selectionchange', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      document.removeEventListener('selectionchange', schedule);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  });
</script>

{#if spot}
  <button
    class="pill"
    class:below={spot.below}
    style:left="{spot.x}px"
    style:top="{spot.y}px"
    title="Ask about the selected text"
    onmousedown={(e) => e.preventDefault()}
    onclick={ask}>✦ ask about this</button
  >
{/if}

<style>
  .pill {
    position: fixed;
    /* Over the sticky header, which sits at 30. */
    z-index: 40;
    transform: translate(-50%, -100%);
    white-space: nowrap;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 6px 12px;
    color: var(--fg);
    font:
      12px 'DM Sans',
      sans-serif;
    cursor: pointer;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .pill.below {
    transform: translate(-50%, 0);
  }
  .pill:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
</style>
