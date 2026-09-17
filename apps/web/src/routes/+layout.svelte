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
  :global(*) {
    box-sizing: border-box;
  }
</style>
