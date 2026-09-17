<script lang="ts">
	// PROTOTYPE: renders one Answer's parts with inline Citation chips. Shared by all panel variants.
	import { lines, type Part } from './chat';
	interface Props { parts: Part[]; oncite: (nodeId: number) => void; focused: number | null; compact?: boolean }
	let { parts, oncite, focused, compact = false }: Props = $props();
	const rows = $derived(lines(parts));
	const isTableRow = (r: Part[]) => r[0]?.kind === 'text' && r[0].text.trimStart().startsWith('|');
</script>

<div class="answer" class:compact>
	{#each rows as row, ri (ri)}
		{#if isTableRow(row)}
			{#if !row.some((p) => p.kind === 'text' && /^\|\s*-{3}/.test(p.text.trim()))}
				<div class="row" class:head={ri === 0 || rows[ri - 1]?.[0]?.kind !== 'text' || !isTableRow(rows[ri - 1])}>
					{#each row as p, pi (pi)}
						{#if p.kind === 'cite'}<button class="cite" class:focused={focused === p.nodeId} onclick={() => oncite(p.nodeId)}>{p.title}<sup>{p.ordinal + 1}</sup></button>
						{:else}{#each p.text.split('|').filter((_, i, a) => i > 0 && i < a.length - 1) as cell, ci (ci)}<span class="cell">{cell.trim()}</span>{/each}{/if}
					{/each}
				</div>
			{/if}
		{:else}
			<p>
				{#each row as p, pi (pi)}
					{#if p.kind === 'cite'}<button class="cite" class:focused={focused === p.nodeId} onclick={() => oncite(p.nodeId)}>{p.title}<sup>{p.ordinal + 1}</sup></button>
					{:else}{p.text}{/if}
				{/each}
			</p>
		{/if}
	{/each}
</div>

<style>
	.answer { font: 400 14.5px/1.6 "DM Sans", system-ui, sans-serif; color: #f1efe9; }
	.answer.compact { font-size: 13.5px; line-height: 1.5; }
	p { margin: 0 0 10px; } p:last-child { margin-bottom: 0; }
	.row { display: grid; grid-template-columns: 1fr 2fr; gap: 6px 14px; padding: 6px 0; border-bottom: 1px solid rgba(241,239,233,.08); font-size: 13px; }
	.row.head { color: #9d9a92; font: 10px/1.6 "Azeret Mono", monospace; letter-spacing: .12em; text-transform: uppercase; }
	.cite {
		display: inline; background: none; border: 0; padding: 0 2px; margin: 0; font: inherit; color: #ff8a72; cursor: pointer;
		border-bottom: 1px solid rgba(255,138,114,.45); transition: background .15s, border-color .15s;
	}
	.cite:hover, .cite.focused { background: rgba(255,138,114,.14); border-bottom-color: #ff8a72; border-radius: 3px; }
	.cite sup { font: 9px/1 "Azeret Mono", monospace; color: #9d9a92; margin-left: 2px; }
</style>
