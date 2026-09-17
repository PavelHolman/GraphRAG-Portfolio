<script lang="ts">
	// PROTOTYPE iteration 2: variant A won. Three strengths of the answer-time gravity shift,
	// switchable via ?variant=A|B|C, plus a modern visual pass. Fake data; nothing here is production.
	import { Canvas } from '@threlte/core';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import VariantA from '$lib/proto/VariantA.svelte';
	import Switcher from '$lib/proto/Switcher.svelte';
	import { makeGraph, makeTurns, type Subgraph } from '$lib/proto/graph';

	const variants = [
		{ key: 'A', name: 'Static layout', pull: 0 },
		{ key: 'B', name: 'Mild gravity shift', pull: 0.45 },
		{ key: 'C', name: 'Strong gravity shift', pull: 0.75 }
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'B');
	const pull = $derived(variants.find((v) => v.key === variant)?.pull ?? 0.45);

	const graph = makeGraph();
	const turns = makeTurns(graph);
	let subgraph = $state<Subgraph | null>(null);
	let picked = $state<number | null>(null);

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

<svelte:head>
	<title>Scene prototype · {variant}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&family=Azeret+Mono:wght@400&family=Bricolage+Grotesque:wght@600&display=swap" rel="stylesheet" />
</svelte:head>

<div class="stage">
	<Canvas dpr={[1, 2]} renderMode="on-demand" shadows={false}>
		{#key variant}
			<VariantA {graph} {subgraph} {zoom} {pull} onpick={(i) => (picked = i)} />
		{/key}
	</Canvas>
</div>

<header class="hud">
	<div class="stats"><span class="dot"></span>{fps} fps · dpr {dpr} · {graph.nodes.length} nodes
		{#if lost}<strong> · context lost, reload</strong>{/if}</div>
	<div class="turns">
		{#each turns as t, i (i)}
			<button class:active={subgraph === t} onclick={() => (subgraph = t)}>{t.name}</button>
		{/each}
		<button class="ghost" onclick={() => (subgraph = null)}>Clear</button>
	</div>
</header>

{#if picked != null}
	<aside class="pick">
		<span class="type">{graph.nodes[picked].type}</span>
		<b>{graph.nodes[picked].title}</b>
		<small>{graph.nodes[picked].degree} connections</small>
	</aside>
{/if}

<Switcher {variants} current={variant} />

<style>
	:global(html, body) {
		margin: 0; height: 100%; color: #f1efe9; overscroll-behavior: none;
		font: 14px/1.5 "DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
		background: radial-gradient(90% 60% at 50% 0%, #1d1b19 0%, #161514 60%, #0f0e0d 100%) fixed;
		-webkit-font-smoothing: antialiased;
	}
	.stage { position: fixed; inset: 0; touch-action: none; }
	.hud {
		position: fixed; top: max(12px, env(safe-area-inset-top)); left: 12px; right: 12px;
		display: flex; flex-direction: column; gap: 10px; pointer-events: none;
	}
	.hud > * { pointer-events: auto; }
	.stats {
		font: 11px/1 "Azeret Mono", ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase;
		color: #9d9a92; display: flex; align-items: center; gap: 8px;
	}
	.dot { width: 6px; height: 6px; border-radius: 50%; background: #ff8a72; box-shadow: 0 0 10px #ff8a72; }
	.turns { display: flex; flex-wrap: wrap; gap: 8px; }
	.turns button {
		background: #0f0e0d; color: #f1efe9; border: 1px solid rgba(241,239,233,.12);
		border-radius: 999px; padding: 9px 16px; font: 500 13px "DM Sans", system-ui, sans-serif;
		transition: background .15s, border-color .15s, transform .15s, color .15s;
	}
	.turns button:hover { border-color: rgba(241,239,233,.28); }
	.turns button:active { transform: scale(.97); }
	.turns button.active { background: rgba(255,138,114,.14); border-color: #ff8a72; color: #ff8a72; }
	.turns button.ghost { color: #9d9a92; }
	.pick {
		position: fixed; left: 12px; bottom: max(88px, calc(env(safe-area-inset-bottom) + 88px));
		display: grid; gap: 4px; padding: 14px 18px; border-radius: 12px; max-width: min(320px, calc(100vw - 24px));
		background: #0f0e0d; border: 1px solid rgba(244,242,238,.12); box-shadow: 0 16px 40px rgba(0,0,0,.5);
	}
	.pick .type { font: 10px/1 "Azeret Mono", ui-monospace, monospace; letter-spacing: .14em; text-transform: uppercase; color: #ff8a72; }
	.pick b { font: 600 18px/1.2 "Bricolage Grotesque", "DM Sans", system-ui, sans-serif; letter-spacing: -.01em; }
	.pick small { color: #a6a29a; font-size: 12px; }
	@media (max-width: 600px) { .turns button { font-size: 12px; padding: 8px 13px; } }
</style>
