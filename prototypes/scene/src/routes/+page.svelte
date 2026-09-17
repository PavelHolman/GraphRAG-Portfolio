<script lang="ts">
	// PROTOTYPE iteration 5: card vs strip over the Ember Scene, with idle "attract" hints that auto-play,
	// hover-to-preview, faint cited neighbours after a Turn. ?variant=A|B|C.
	import { Canvas } from '@threlte/core';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import VariantA from '$lib/proto/VariantA.svelte';
	import Switcher from '$lib/proto/Switcher.svelte';
	import ChatCard from '$lib/proto/ChatCard.svelte';
	import ChatStrip from '$lib/proto/ChatStrip.svelte';
	import { makeGraph, type Subgraph } from '$lib/proto/graph';
	import { fakeTurn, emptySubgraph, type TurnEvent } from '$lib/proto/stream';
	import type { Message } from '$lib/proto/chat';

	const variants = [
		{ key: 'A', name: 'Card, underlined citations' },
		{ key: 'B', name: 'Card + citation chips' },
		{ key: 'C', name: 'Strip + citation chips' }
	];
	const variant = $derived(page.url.searchParams.get('variant') ?? 'B');
	const ember = { name: 'Ember', pointScale: 1, seedGlow: 1.8, citedGlow: 0.7, haloK: 2.6, ring: 0, edgeHi: '#8a5f54', edgeRest: '#242220', dustCount: 700, dustOpacity: 0.55, upperLabels: false };
	const HINTS = ['Tell me about your Effect work', 'Does he fit a lead role with Kubernetes and Kafka?', 'Where did you study?', 'What are you strongest at?'];

	const graph = makeGraph();
	let subgraph = $state<Subgraph | null>(null);
	let messages = $state<Message[]>([]);
	let followups = $state<string[]>([]);
	let streaming = $state(false);
	let focused = $state<number | null>(null);
	let picked = $state<number | null>(null);
	let typing = $state(false);       // input focused or non-empty
	let committed = $state(false);    // visitor has sent a real Prompt at least once
	let attract = $state(false);
	let abort: AbortController | null = null;

	const suggestions = $derived(followups.length && !attract ? followups : HINTS);

	function run(prompt: string, suggested: boolean) {
		abort?.abort(); // new Prompt mid-stream: interrupt, keep previous highlight until the new subgraph arrives
		if (messages.at(-1)?.streaming) messages.at(-1)!.streaming = false;
		abort = new AbortController();
		followups = []; focused = null;
		messages.push({ role: 'visitor', suggested, parts: [{ kind: 'text', text: prompt }], streaming: false });
		messages.push({ role: 'answer', parts: [], streaming: true });
		streaming = true;
		let live: Subgraph = emptySubgraph();
		let candidate = new Set<number>();
		fakeTurn(graph, prompt, abort.signal, (e: TurnEvent) => {
			const a = messages.at(-1)!;
			switch (e.type) {
				case 'subgraph':
					candidate = new Set(e.nodeIds);
					live = { name: '', seeds: new Set(), nodes: candidate, edges: new Set(e.edgeIds) };
					subgraph = live; break;
				case 'text': {
					const last = a.parts.at(-1);
					if (last?.kind === 'text') last.text += e.delta; else a.parts.push({ kind: 'text', text: e.delta });
					break;
				}
				case 'citation':
					a.parts.push({ kind: 'cite', nodeId: e.nodeId, ordinal: e.ordinal, title: graph.nodes[e.nodeId].title });
					live = { ...live, seeds: new Set([...live.seeds, e.nodeId]) };
					subgraph = live; break;
				case 'followups': followups = e.prompts; break;
				case 'turn-finished': {
					// used Nodes stay bright; their candidate neighbours stay faintly lit
					const used = new Set(e.usedNodeIds);
					const keep = new Set<number>([...used, 0]);
					graph.edges.forEach((ed) => {
						if (used.has(ed.src) && candidate.has(ed.dst)) keep.add(ed.dst);
						if (used.has(ed.dst) && candidate.has(ed.src)) keep.add(ed.src);
					});
					const edges = new Set<number>();
					graph.edges.forEach((ed, ei) => { if (keep.has(ed.src) && keep.has(ed.dst) && (used.has(ed.src) || used.has(ed.dst))) edges.add(ei); });
					subgraph = { name: '', seeds: used, nodes: keep, edges };
					a.streaming = false; streaming = false; break;
				}
				case 'error': a.error = e.message; a.streaming = false; streaming = false; break;
			}
		});
	}
	const onsend = (p: string) => { committed = true; attract = false; run(p, false); };
	const onpreview = (p: string) => { if (streaming || committed) return; attract = false; run(p, true); };
	const oncite = (nodeId: number) => { focused = nodeId; };
	const oninput = (active: boolean) => { typing = active; if (active) attract = false; };

	// attract loop: while nobody has committed and nobody is typing, auto-play a hint every 9 s
	onMount(() => {
		let i = 0;
		const tick = () => {
			if (committed || typing || streaming) return;
			attract = true;
			run(HINTS[i++ % HINTS.length], true);
		};
		const first = setTimeout(tick, 2500);
		const loop = setInterval(tick, 11000);
		return () => { clearTimeout(first); clearInterval(loop); };
	});

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

<div class="stage">
	<Canvas dpr={[1, 2]} renderMode="on-demand" shadows={false}>
		<VariantA {graph} {subgraph} {zoom} pull={0.45} style={ember} focus={focused} onpick={(i) => (picked = i)} />
	</Canvas>
</div>

<header class="hud">
	<div class="stats"><span class="dot"></span>{fps} fps · {streaming ? 'streaming' : attract ? 'attract' : 'idle'}</div>
</header>

{#if picked != null}
	<aside class="pick"><span class="type">{graph.nodes[picked].type}</span><b>{graph.nodes[picked].title}</b></aside>
{/if}

{#if variant === 'C'}<ChatStrip {messages} {suggestions} {attract} {streaming} {onsend} {onpreview} {oncite} {oninput} {focused} chips />
{:else}<ChatCard {messages} {suggestions} {attract} {streaming} {onsend} {onpreview} {oncite} {oninput} {focused} chips={variant === 'B'} />{/if}

<Switcher {variants} current={variant} />

<style>
	:global(html, body) {
		margin: 0; height: 100%; color: #f1efe9; overscroll-behavior: none;
		font: 14px/1.5 "DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif;
		background: radial-gradient(90% 60% at 50% 0%, #1d1b19 0%, #161514 60%, #0f0e0d 100%) fixed;
		-webkit-font-smoothing: antialiased;
	}
	.stage { position: fixed; inset: 0; touch-action: none; }
	.hud { position: fixed; top: max(12px, env(safe-area-inset-top)); left: 12px; pointer-events: none; }
	.stats { font: 11px/1 "Azeret Mono", monospace; letter-spacing: .12em; text-transform: uppercase; color: #9d9a92; display: flex; align-items: center; gap: 8px; }
	.dot { width: 6px; height: 6px; border-radius: 50%; background: #ff8a72; box-shadow: 0 0 10px #ff8a72; }
	.pick { position: fixed; right: 12px; top: max(12px, env(safe-area-inset-top)); display: grid; gap: 2px; padding: 10px 14px; border-radius: 12px; background: #0f0e0d; border: 1px solid rgba(244,242,238,.12); }
	.pick .type { font: 10px/1 "Azeret Mono", monospace; letter-spacing: .14em; text-transform: uppercase; color: #ff8a72; }
	.pick b { font: 600 15px/1.2 "Bricolage Grotesque", sans-serif; }
</style>
