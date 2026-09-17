<script lang="ts">
	// PROTOTYPE iteration 4: chat panel × Scene. Three panel relationships, switchable via ?variant=A|B|C,
	// over the winning Ember Scene. A fake stream shaped like ADR 0003 drives progressive highlight.
	import { Canvas } from '@threlte/core';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import VariantA from '$lib/proto/VariantA.svelte';
	import Switcher from '$lib/proto/Switcher.svelte';
	import ChatA from '$lib/proto/ChatA.svelte';
	import ChatB from '$lib/proto/ChatB.svelte';
	import ChatC from '$lib/proto/ChatC.svelte';
	import { makeGraph, type Subgraph } from '$lib/proto/graph';
	import { fakeTurn, emptySubgraph, type TurnEvent } from '$lib/proto/stream';
	import type { Message } from '$lib/proto/chat';

	const variants = [
		{ key: 'A', name: 'Side panel / bottom sheet' },
		{ key: 'B', name: 'Floating card + bar' },
		{ key: 'C', name: 'Scene-first strip' }
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'A');
	const ember = { name: 'Ember', pointScale: 1, seedGlow: 1.8, citedGlow: 0.7, haloK: 2.6, ring: 0, edgeHi: '#8a5f54', edgeRest: '#242220', dustCount: 700, dustOpacity: 0.55, upperLabels: false };

	const graph = makeGraph();
	let subgraph = $state<Subgraph | null>(null);
	let messages = $state<Message[]>([]);
	let followups = $state<string[]>([]);
	let streaming = $state(false);
	let focused = $state<number | null>(null);
	let picked = $state<number | null>(null);
	let abort: AbortController | null = null;

	function onsend(prompt: string) {
		abort?.abort(); // new Prompt mid-stream: interrupt, keep previous highlight until the new subgraph arrives
		if (messages.at(-1)?.streaming) messages.at(-1)!.streaming = false;
		abort = new AbortController();
		followups = []; focused = null;
		messages.push({ role: 'visitor', parts: [{ kind: 'text', text: prompt }], streaming: false });
		const answer: Message = { role: 'answer', parts: [], streaming: true };
		messages.push(answer);
		streaming = true;
		let live: Subgraph = emptySubgraph();
		fakeTurn(graph, prompt, abort.signal, (e: TurnEvent) => {
			const a = messages.at(-1)!;
			switch (e.type) {
				case 'subgraph':
					live = { name: '', seeds: new Set(), nodes: new Set(e.nodeIds), edges: new Set(e.edgeIds) };
					subgraph = live; // candidate: pre-dim everything else
					break;
				case 'text': {
					const last = a.parts.at(-1);
					if (last?.kind === 'text') last.text += e.delta; else a.parts.push({ kind: 'text', text: e.delta });
					break;
				}
				case 'citation':
					a.parts.push({ kind: 'cite', nodeId: e.nodeId, ordinal: e.ordinal, title: graph.nodes[e.nodeId].title });
					live = { ...live, seeds: new Set([...live.seeds, e.nodeId]) };
					subgraph = live; // progressive highlight
					break;
				case 'followups': followups = e.prompts; break;
				case 'turn-finished':
					subgraph = { name: '', seeds: new Set(e.usedNodeIds), nodes: new Set([...e.usedNodeIds, 0]), edges: new Set(e.usedEdgeIds) };
					a.streaming = false; streaming = false; break;
				case 'error': a.error = e.message; a.streaming = false; streaming = false; break;
			}
		});
	}
	function oncite(nodeId: number) { focused = nodeId; }

	let fps = $state(0), dpr = $state(1), zoom = $state(1);
	onMount(() => {
		dpr = Math.min(window.devicePixelRatio, 2);
		zoom = window.innerWidth < window.innerHeight ? 1.9 : 1;
		let frames = 0, last = performance.now(), raf = 0;
		const tick = (t: number) => { frames++; if (t - last >= 1000) { fps = frames; frames = 0; last = t; } raf = requestAnimationFrame(tick); };
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});
</script>

<svelte:head>
	<title>Chat prototype · {variant}</title>
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Azeret+Mono:wght@400&family=Bricolage+Grotesque:wght@600&display=swap" rel="stylesheet" />
</svelte:head>

<div class="stage" class:withPanel={variant === 'A'}>
	<Canvas dpr={[1, 2]} renderMode="on-demand" shadows={false}>
		<VariantA {graph} {subgraph} {zoom} pull={0.45} style={ember} focus={focused} onpick={(i) => (picked = i)} />
	</Canvas>
</div>

<header class="hud">
	<div class="stats"><span class="dot"></span>{fps} fps · dpr {dpr} · {graph.nodes.length} nodes · {streaming ? 'streaming' : 'idle'}</div>
</header>

{#if picked != null && variant !== 'A'}
	<aside class="pick"><span class="type">{graph.nodes[picked].type}</span><b>{graph.nodes[picked].title}</b></aside>
{/if}

{#if variant === 'B'}<ChatB {messages} {followups} {streaming} {onsend} {oncite} {focused} />
{:else if variant === 'C'}<ChatC {messages} {followups} {streaming} {onsend} {oncite} {focused} />
{:else}<ChatA {messages} {followups} {streaming} {onsend} {oncite} {focused} />{/if}

<Switcher {variants} current={variant} />

<style>
	:global(html, body) {
		margin: 0; height: 100%; color: #f1efe9; overscroll-behavior: none;
		font: 14px/1.5 "DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
		background: radial-gradient(90% 60% at 50% 0%, #1d1b19 0%, #161514 60%, #0f0e0d 100%) fixed;
		-webkit-font-smoothing: antialiased;
	}
	.stage { position: fixed; inset: 0; touch-action: none; }
	.stage.withPanel { right: min(400px, 100vw); }
	@media (max-width: 700px) { .stage.withPanel { right: 0; bottom: 112px; } }
	.hud { position: fixed; top: max(12px, env(safe-area-inset-top)); left: 12px; pointer-events: none; }
	.stats { font: 11px/1 "Azeret Mono", monospace; letter-spacing: .12em; text-transform: uppercase; color: #9d9a92; display: flex; align-items: center; gap: 8px; }
	.dot { width: 6px; height: 6px; border-radius: 50%; background: #ff8a72; box-shadow: 0 0 10px #ff8a72; }
	.pick { position: fixed; right: 12px; top: max(12px, env(safe-area-inset-top)); display: grid; gap: 2px; padding: 10px 14px; border-radius: 12px; background: #0f0e0d; border: 1px solid rgba(244,242,238,.12); }
	.pick .type { font: 10px/1 "Azeret Mono", monospace; letter-spacing: .14em; text-transform: uppercase; color: #ff8a72; }
	.pick b { font: 600 15px/1.2 "Bricolage Grotesque", sans-serif; }
</style>
