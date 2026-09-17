<script lang="ts">
  // Select any text in the page and a pill in the bottom-right corner offers to ask about it, so a
  // reader can dig into a phrase a card or an Answer mentions without retyping it. A fixed corner
  // rather than a bubble over the selection: it never fights the browser's own selection menu and
  // never has to be repositioned while scrolling. docs/spec/page.md.
  import { onMount } from 'svelte';
  interface Props {
    /** Runs the selected text as a Prompt. */
    onask: (prompt: string) => void;
  }
  let { onask }: Props = $props();
  /** Below this a selection is an accident; above it, a paragraph rather than a question. */
  const MIN_CHARS = 3;
  const MAX_CHARS = 200;
  /** The pill quotes the selection so "this" is never ambiguous from the corner. */
  const SNIPPET_CHARS = 34;

  let text = $state('');
  const snippet = $derived(
    text.length > SNIPPET_CHARS ? `${text.slice(0, SNIPPET_CHARS).trimEnd()}…` : text,
  );

  /** Page content only: never the sticky header, the Scene's pick card or a form field. */
  const inContent = (n: Node | null): boolean => {
    const el = n instanceof Element ? n : (n?.parentElement ?? null);
    if (!el || el.closest('input, textarea, header, .pick')) return false;
    return Boolean(el.closest('#top, main'));
  };

  const read = () => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      text = '';
      return;
    }
    const picked = sel.toString().replace(/\s+/g, ' ').trim();
    const usable =
      picked.length >= MIN_CHARS &&
      picked.length <= MAX_CHARS &&
      inContent(sel.anchorNode) &&
      inContent(sel.focusNode);
    text = usable ? picked : '';
  };

  const ask = () => {
    const prompt = text;
    document.getSelection()?.removeAllRanges();
    text = '';
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
    return () => document.removeEventListener('selectionchange', schedule);
  });
</script>

{#if text}
  <button
    class="pill"
    title="Ask about the selected text"
    onmousedown={(e) => e.preventDefault()}
    onclick={ask}><span class="lead">✦ ask about</span><q>{snippet}</q></button
  >
{/if}

<style>
  .pill {
    position: fixed;
    right: 16px;
    bottom: max(16px, calc(env(safe-area-inset-bottom) + 16px));
    /* Over the sticky header, which sits at 30. */
    z-index: 40;
    max-width: min(320px, calc(100vw - 32px));
    display: flex;
    gap: 6px;
    align-items: baseline;
    background: var(--panel);
    border: 1px solid var(--accent);
    border-radius: 999px;
    padding: 9px 16px;
    color: var(--fg);
    font:
      12.5px 'DM Sans',
      sans-serif;
    cursor: pointer;
    box-shadow: 0 12px 34px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: rise 0.18s ease;
  }
  .pill .lead {
    flex: none;
    white-space: nowrap;
  }
  .pill q {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--accent);
  }
  .pill:hover {
    background: var(--accent-soft);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .pill {
      animation: none;
    }
  }
</style>
