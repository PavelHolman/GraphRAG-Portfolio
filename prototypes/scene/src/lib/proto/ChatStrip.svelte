<script lang="ts">
	// PROTOTYPE "Scene-first strip": compact answer strip under the HUD, numbered citation chips, thin input line.
	import Answer from './Answer.svelte';
	import type { ChatProps, Cite } from './chat';
	let { messages, suggestions, attract, streaming, onsend, onpreview, oncite, oninput, focused, chips = true }: ChatProps = $props();
	let draft = $state('');
	let open = $state(false);
	const current = $derived(messages.filter((m) => m.role === 'answer').at(-1));
	const lastPrompt = $derived([...messages].reverse().find((m) => m.role === 'visitor'));
	const cites = $derived((current?.parts.filter((p) => p.kind === 'cite') ?? []) as Cite[]);
	function send(p = draft) { if (!p.trim()) return; onsend(p.trim()); draft = ''; open = false; }
	$effect(() => { oninput(draft.length > 0); });
</script>

{#if current}
	<section class="strip" class:open>
		<button class="toggle" onclick={() => (open = !open)} aria-label="expand answer">{open ? '−' : '+'}</button>
		<div class="text">
			<div class="q">{lastPrompt?.suggested ? '✦ ' : ''}{lastPrompt?.parts[0].kind === 'text' ? lastPrompt.parts[0].text : ''}</div>
			<Answer parts={current.parts} {oncite} {focused} compact />{#if current.streaming}<span class="caret"></span>{/if}
		</div>
	</section>
	{#if chips && cites.length}
		<div class="cites">{#each cites as c (c.ordinal)}<button class:focused={focused === c.nodeId} onclick={() => oncite(c.nodeId)}><i>{c.ordinal + 1}</i>{c.title}</button>{/each}</div>
	{/if}
{/if}

<form class="line" onsubmit={(e) => { e.preventDefault(); send(); }}>
	{#if suggestions.length && !streaming}
		<div class="sugg" class:attract>
			{#if attract}<span class="k">Try asking</span>{/if}
			{#each suggestions as s (s)}<button type="button" onmouseenter={() => onpreview(s)} onfocus={() => onpreview(s)} onclick={() => send(s)}>{s}</button>{/each}
		</div>
	{/if}
	<div class="input">
		<span class="prompt">›</span>
		<input bind:value={draft} placeholder={streaming ? 'Streaming… type to interrupt' : 'Ask anything about Pavel'} onfocus={() => oninput(true)} onblur={() => oninput(draft.length > 0)} />
		<button type="submit" aria-label="send">↵</button>
	</div>
</form>

<style>
	.strip {
		position: fixed; top: 44px; left: 12px; right: 12px; margin: 0 auto; max-width: 720px; display: flex; gap: 10px; align-items: flex-start;
		background: rgba(15,14,13,.78); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
		border: 1px solid rgba(241,239,233,.1); border-radius: 12px; padding: 10px 12px; z-index: 20; color: #f1efe9;
	}
	.q { font: 10px/1.6 "Azeret Mono", monospace; letter-spacing: .1em; text-transform: uppercase; color: #9d9a92; margin-bottom: 2px; }
	.text { max-height: 4.6em; overflow: hidden; flex: 1; mask-image: linear-gradient(#000 65%, transparent); }
	.strip.open .text { max-height: 50vh; overflow: auto; mask-image: none; }
	.toggle { flex: none; width: 24px; height: 24px; border-radius: 6px; border: 1px solid rgba(241,239,233,.14); background: none; color: #9d9a92; }
	.caret { display: inline-block; width: 6px; height: 12px; background: #ff8a72; margin-left: 3px; animation: blink 1s steps(2) infinite; }
	@keyframes blink { to { opacity: 0; } }
	.cites { position: fixed; top: calc(44px + 4.6em + 34px); left: 12px; right: 12px; margin: 0 auto; max-width: 720px; display: flex; gap: 6px; overflow-x: auto; z-index: 20; padding-bottom: 4px; }
	.cites button { flex: none; display: flex; align-items: center; gap: 6px; background: #0f0e0d; border: 1px solid rgba(241,239,233,.12); color: #f1efe9; border-radius: 999px; padding: 5px 10px 5px 6px; font: 12px "DM Sans", sans-serif; }
	.cites button i { font: 9px/1 "Azeret Mono", monospace; font-style: normal; width: 16px; height: 16px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,138,114,.18); color: #ff8a72; }
	.cites button.focused, .cites button:hover { border-color: #ff8a72; }
	.line { position: fixed; left: 12px; right: 12px; bottom: max(64px, calc(env(safe-area-inset-bottom) + 64px)); margin: 0 auto; max-width: 720px; display: grid; gap: 8px; z-index: 21; }
	.sugg { display: flex; gap: 6px; overflow-x: auto; align-items: center; }
	.sugg .k { flex: none; font: 10px/1 "Azeret Mono", monospace; letter-spacing: .12em; text-transform: uppercase; color: #9d9a92; margin-right: 4px; }
	.sugg button { flex: none; background: none; border: 1px solid rgba(241,239,233,.14); color: #9d9a92; border-radius: 999px; padding: 5px 10px; font: 12px "DM Sans", sans-serif; }
	.sugg button:hover { color: #ff8a72; border-color: #ff8a72; }
	.sugg.attract button { animation: pulse 3s ease-in-out infinite; }
	@keyframes pulse { 50% { border-color: rgba(255,138,114,.5); } }
	.input { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid rgba(241,239,233,.2); padding: 8px 4px; }
	.prompt { color: #ff8a72; font: 16px "Azeret Mono", monospace; }
	input { flex: 1; background: none; border: 0; color: #f1efe9; font: 15px "DM Sans", sans-serif; outline: none; min-width: 0; }
	.input button { background: none; border: 0; color: #9d9a92; font-size: 16px; }
	@media (max-width: 700px) { .strip { top: 84px; } .cites { top: calc(84px + 4.6em + 34px); } }
</style>
