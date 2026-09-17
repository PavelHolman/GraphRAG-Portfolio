<script lang="ts">
	// PROTOTYPE: three variants of the Scene, switchable via ?variant=A|B|C on this route.
	// Question: layout legibility, highlight visual language, delta animation timing, mobile frame rate,
	// touch camera controls. Fake data; nothing here is production.
	import { Canvas } from '@threlte/core';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import VariantA from '$lib/proto/VariantA.svelte';
	import VariantB from '$lib/proto/VariantB.svelte';
	import VariantC from '$lib/proto/VariantC.svelte';
	import Switcher from '$lib/proto/Switcher.svelte';
	import { makeGraph, makeTurns, TYPE_COLOR, type Subgraph } from '$lib/proto/graph';

	const variants = [
		{ key: 'A', name: 'Force cloud (orbit)' }, { key: 'B', name: 'Concentric shells (designed)' }, { key: 'C', name: 'Stacked layers (2.5D, pan/zoom)' }
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');

	const graph = makeGraph();
	const turns = makeTurns(graph);
	let subgraph = $state<Subgraph | null>(null);
	let picked = $state<number | null>(null);

	// fps + draw call overlay
	let fps = $state(0);
	let lost = $state(false);
	let dpr = $state(1);
	let zoom = $state(1);
	onMount(() => {
		dpr = Math.min(window.devicePixelRatio, 2);
		zoom = window.innerWidth < window.innerHeight ? 1.9 : 1;
		let frames = 0, last = performance.now();
		let raf = 0;
		const tick = (t: number) => {
			frames++;
			if (t - last >= 1000) { fps = frames; frames = 0; last = t; }
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		const c = document.querySelector('canvas');
		const onLost = (e: Event) => { e.preventDefault(); lost = true; };
		c?.addEventListener('webglcontextlost', onLost);
		return () => { cancelAnimationFrame(raf); c?.removeEventListener('webglcontextlost', onLost); };
	});
</script>

<svelte:head><title>Scene prototype · {variant}</title></svelte:head>

<div class="stage">
	<Canvas dpr={[1, 2]} renderMode="on-demand" shadows={false}>
		{#if variant === 'B'}
			<VariantB {graph} {subgraph} {zoom} onpick={(i) => (picked = i)} />
		{:else if variant === 'C'}
			<VariantC {graph} {subgraph} {zoom} onpick={(i) => (picked = i)} />
		{:else}
			<VariantA {graph} {subgraph} {zoom} onpick={(i) => (picked = i)} />
		{/if}
	</Canvas>
</div>

<div class="hud">
	<div class="stats">
		{fps} fps · dpr {dpr} · {graph.nodes.length} nodes · {graph.edges.length} edges
		{#if lost}<strong> · WebGL context lost, reload</strong>{/if}
	</div>
	<div class="turns">
		{#each turns as t, i (i)}
			<button class:active={subgraph === t} onclick={() => (subgraph = t)}>{t.name}</button>
		{/each}
		<button onclick={() => (subgraph = null)}>Clear</button>
	</div>
	{#if picked != null}
		<div class="pick" style="border-color: {TYPE_COLOR[graph.nodes[picked].type]}">
			<b>{graph.nodes[picked].title}</b> <small>{graph.nodes[picked].type} · degree {graph.nodes[picked].degree}</small>
		</div>
	{/if}
	<div class="legend">
		{#each Object.entries(TYPE_COLOR) as [t, c] (t)}<span><i style="background: {c}"></i>{t}</span>{/each}
	</div>
</div>

<Switcher {variants} current={variant} />

<style>
	:global(html, body) { margin: 0; height: 100%; background: #0b0e14; color: #e6e9ef; font: 13px system-ui; overscroll-behavior: none; }
	.stage { position: fixed; inset: 0; touch-action: none; }
	.hud { position: fixed; top: max(8px, env(safe-area-inset-top)); left: 8px; right: 8px; display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
	.hud > * { pointer-events: auto; }
	.stats { font-variant-numeric: tabular-nums; opacity: .8; }
	.turns { display: flex; flex-wrap: wrap; gap: 6px; }
	.turns button { background: #1a2030; color: #e6e9ef; border: 1px solid #2c3446; border-radius: 8px; padding: 6px 10px; font-size: 12px; }
	.turns button.active { background: #2f6fed; border-color: #2f6fed; }
	.pick { background: #131826; border-left: 3px solid; padding: 6px 10px; border-radius: 6px; max-width: 320px; }
	.legend { display: flex; flex-wrap: wrap; gap: 8px; opacity: .8; font-size: 11px; }
	.legend i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 4px; }
	@media (max-width: 600px) { .legend { display: none; } .turns button { font-size: 11px; padding: 5px 8px; } }
</style>
