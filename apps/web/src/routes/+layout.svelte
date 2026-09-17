<script lang="ts">
  let { children } = $props();
</script>

{@render children()}

<style>
  :global(:root) {
    --bg: #161514;
    --bg-soft: #1d1b19;
    --surface: #0b0a09;
    --fg: #f1efe9;
    --fg-muted: #9d9a92;
    --line: rgba(241, 239, 233, 0.12);
    --accent: #ff8a72;
    --accent-soft: rgba(255, 138, 114, 0.14);
    --panel: #0f0e0d;
  }
  :global(html, body) {
    margin: 0;
    color: var(--fg);
    background: var(--bg);
    font:
      14px/1.5 'DM Sans',
      ui-sans-serif,
      system-ui,
      -apple-system,
      sans-serif;
    -webkit-font-smoothing: antialiased;
    scroll-behavior: smooth;
  }
  /* The selection is part of the design: a warm tint, not the browser's blue. `SelectionAsk` marks
     each end of a selection with an accent bar and offers to ask about it. */
  :global(::selection) {
    background: rgba(255, 138, 114, 0.26);
    color: var(--fg);
  }
  :global(*) {
    box-sizing: border-box;
    scrollbar-width: thin;
    scrollbar-color: rgba(241, 239, 233, 0.18) transparent;
  }
  :global(*::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }
  :global(*::-webkit-scrollbar-thumb) {
    background: rgba(241, 239, 233, 0.18);
    border-radius: 999px;
  }
  :global(*::-webkit-scrollbar-track) {
    background: transparent;
  }
</style>
