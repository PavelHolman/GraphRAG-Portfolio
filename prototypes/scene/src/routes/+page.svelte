<script lang="ts">
	// PROTOTYPE iteration 2: variant A won. Three strengths of the answer-time gravity shift,
	// switchable via ?variant=A|B|C, plus a modern visual pass. Fake data; nothing here is production.
	import { Canvas } from '@threlte/core';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import VariantA from '$lib/proto/VariantA.svelte';
	import Switcher from '$lib/proto/Switcher.svelte';
	import { makeGraph, makeTurns, TYPE_COLOR, type Subgraph } from '$lib/proto/graph';

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
	<aside class="pick" style="--c: {TYPE_COLOR[graph.nodes[picked].type]}">
		<span class="type">{graph.nodes[picked].type}</span>
		<b>{graph.nodes[picked].title}</b>
		<small>{graph.nodes[picked].degree} connections</small>
	</aside>
{/if}

<Switcher {variants} current={variant} />

<style>
	:global(html, body) {
		margin: 0; height: 100%; color: #e8ecf5; overscroll-behavior: none;
		font: 13px/1.4 -apple-system, "SF Pro Text", Inter, system-ui, sans-serif;
		background: radial-gradient(120% 80% at 50% 10%, #141a2b 0%, #0a0d16 55%, #05070c 100%) fixed;
		-webkit-font-smoothing: antialiased;
	}
	.stage { position: fixed; inset: 0; touch-action: none; }
	.hud {
		position: fixed; top: max(10px, env(safe-area-inset-top)); left: 10px; right: 10px;
		display: flex; flex-direction: column; gap: 8px; pointer-events: none;
	}
	.hud > * { pointer-events: auto; }
	.stats { font-variant-numeric: tabular-nums; color: #8b93a7; font-size: 11px; letter-spacing: .02em; text-transform: uppercase; display: flex; align-items: center; gap: 6px; }
	.dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 8px #4ade80; }
	.turns { display: flex; flex-wrap: wrap; gap: 6px; }
	.turns button {
		background: rgba(255,255,255,.06); color: #e8ecf5; border: 1px solid rgba(255,255,255,.1);
		border-radius: 999px; padding: 8px 14px; font-size: 12px; font-weight: 500;
		backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
		transition: background .15s, border-color .15s, transform .15s;
	}
	.turns button:active { transform: scale(.97); }
	.turns button.active { background: rgba(120,140,255,.22); border-color: rgba(140,160,255,.55); box-shadow: 0 0 0 1px rgba(140,160,255,.25), 0 8px 24px rgba(80,100,255,.25); }
	.turns button.ghost { color: #8b93a7; }
	.pick {
		position: fixed; left: 10px; bottom: max(84px, calc(env(safe-area-inset-bottom) + 84px));
		display: grid; gap: 2px; padding: 10px 14px 10px 16px; border-radius: 14px; max-width: min(320px, calc(100vw - 20px));
		background: rgba(14,18,30,.7); border: 1px solid rgba(255,255,255,.08); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
		box-shadow: inset 3px 0 0 var(--c), 0 12px 32px rgba(0,0,0,.45);
	}
	.pick .type { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--c); }
	.pick b { font-size: 15px; font-weight: 600; }
	.pick small { color: #8b93a7; }
	@media (max-width: 600px) { .turns button { font-size: 11px; padding: 7px 11px; } }
</style>
