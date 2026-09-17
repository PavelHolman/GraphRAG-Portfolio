<script lang="ts">
  // Renders one Answer's parts with inline Citations: coral, underlined, superscript ordinal.
  import { rows, tableCells, type Part } from './types.ts';
  interface Props {
    parts: Part[];
    focused: string | null;
    oncite: (id: string, label: string) => void;
  }
  let { parts, focused, oncite }: Props = $props();
  const lines = $derived(rows(parts));
  const isTableRow = (r: Part[]) => r[0]?.kind === 'text' && r[0].text.trimStart().startsWith('|');
  const isSeparator = (r: Part[]) =>
    r.some((p) => p.kind === 'text' && /^\|\s*-{3}/.test(p.text.trim()));
  const cite = (id: string, label: string) => () => oncite(id, label);
</script>

<div class="answer">
  {#each lines as row, ri (ri)}
    {#if isTableRow(row)}
      {#if !isSeparator(row)}
        {@const cells = tableCells(row)}
        <div
          class="row"
          class:head={ri === 0 || !isTableRow(lines[ri - 1] ?? [])}
          class:two={cells.length === 2}
        >
          {#each cells as cell, ci (ci)}
            <span class="cell">
              {#each cell as p, pi (pi)}
                {#if p.kind === 'cite'}<button
                    class="cite"
                    class:bare={!p.label}
                    class:focused={focused === p.id}
                    title={p.title}
                    onclick={cite(p.id, p.label)}>{p.label}<sup>{p.ordinal + 1}</sup></button
                  >{:else}{p.text}{/if}
              {/each}
            </span>
          {/each}
        </div>
      {/if}
    {:else}
      <p>
        {#each row as p, pi (pi)}
          {#if p.kind === 'cite'}<button
              class="cite"
              class:bare={!p.label}
              class:focused={focused === p.id}
              title={p.title}
              onclick={cite(p.id, p.label)}>{p.label}<sup>{p.ordinal + 1}</sup></button
            >{:else}{p.text}{/if}
        {/each}
      </p>
    {/if}
  {/each}
</div>

<style>
  .answer {
    font:
      400 14.5px/1.6 'DM Sans',
      system-ui,
      sans-serif;
    color: var(--fg);
  }
  p {
    margin: 0 0 10px;
  }
  p:last-child {
    margin-bottom: 0;
  }
  .row {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 6px 14px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(241, 239, 233, 0.08);
    font-size: 13px;
  }
  .row.two {
    grid-template-columns: 1fr 2fr;
    grid-auto-flow: row;
  }
  .row.head {
    color: var(--fg-muted);
    font:
      10px/1.6 'Azeret Mono',
      monospace;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .cite {
    display: inline;
    background: none;
    border: 0;
    padding: 0 2px;
    margin: 0;
    font: inherit;
    color: var(--accent);
    cursor: pointer;
    border-bottom: 1px solid rgba(255, 138, 114, 0.45);
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .cite:hover,
  .cite.focused {
    background: var(--accent-soft);
    border-bottom-color: var(--accent);
    border-radius: 3px;
  }
  .cite.bare {
    border-bottom: 0;
    padding: 0;
  }
  .cite sup {
    font:
      9px/1 'Azeret Mono',
      monospace;
    color: var(--fg-muted);
    margin-left: 2px;
  }
  @media (max-width: 700px) {
    .answer {
      font-size: 13.5px;
      line-height: 1.5;
    }
  }
</style>
