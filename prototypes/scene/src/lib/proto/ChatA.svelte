<script lang="ts">
	// PROTOTYPE Chat variant A: "Side panel". Desktop: fixed right column beside the Scene.
	// Mobile: bottom sheet over the Scene with a drag handle, half-height while streaming, collapsible.
	import Answer from './Answer.svelte';
	import type { ChatProps } from './chat';
	let { messages, followups, streaming, onsend, oncite, focused }: ChatProps = $props();
	let draft = $state('');
	let expanded = $state(true);
	let log = $state<HTMLElement>();
	$effect(() => { messages.length; messages.at(-1)?.parts.length; log?.scrollTo({ top: log.scrollHeight }); });
	function send(p = draft) { if (!p.trim()) return; onsend(p.trim()); draft = ''; expanded = true; }
</script>

<aside class="panel" class:collapsed={!expanded}>
	<button class="handle" onclick={() => (expanded = !expanded)} aria-label="toggle panel"><span></span></button>
	<header><span class="k">Ask about Pavel</span><span class="dot" class:live={streaming}></span></header>
	<div class="log" bind:this={log}>
		{#each messages as m, i (i)}
			{#if m.role === 'visitor'}<div class="you">{m.parts[0].kind === 'text' ? m.parts[0].text : ''}</div>
			{:else}<div class="ans"><Answer parts={m.parts} {oncite} {focused} />{#if m.streaming}<span class="caret"></span>{/if}{#if m.error}<div class="err">{m.error}</div>{/if}</div>{/if}
		{/each}
		{#if followups.length && !streaming}
			<div class="chips">{#each followups as f (f)}<button onclick={() => send(f)}>{f}</button>{/each}</div>
		{/if}
	</div>
	<form onsubmit={(e) => { e.preventDefault(); send(); }}>
		<input bind:value={draft} placeholder="Ask a question or paste a job description" />
		<button type="submit" aria-label="send">↑</button>
	</form>
</aside>

<style>
	.panel {
		position: fixed; top: 0; right: 0; bottom: 0; width: min(400px, 100vw); display: flex; flex-direction: column;
		background: rgba(15,14,13,.82); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
		border-left: 1px solid rgba(241,239,233,.1); color: #f1efe9; z-index: 20;
	}
	.handle { display: none; }
	header { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px 10px; }
	.k { font: 10px/1 "Azeret Mono", monospace; letter-spacing: .14em; text-transform: uppercase; color: #9d9a92; }
	.dot { width: 6px; height: 6px; border-radius: 50%; background: #3a3835; } .dot.live { background: #ff8a72; box-shadow: 0 0 10px #ff8a72; }
	.log { flex: 1; overflow: auto; padding: 4px 20px 12px; display: flex; flex-direction: column; gap: 14px; }
	.you { align-self: flex-end; max-width: 85%; background: rgba(241,239,233,.08); border: 1px solid rgba(241,239,233,.1); border-radius: 14px 14px 4px 14px; padding: 9px 13px; font-size: 14px; }
	.ans { position: relative; }
	.caret { display: inline-block; width: 7px; height: 14px; background: #ff8a72; margin-left: 3px; vertical-align: -2px; animation: blink 1s steps(2) infinite; }
	@keyframes blink { to { opacity: 0; } }
	.err { color: #ff8a72; font-size: 12px; margin-top: 6px; }
	.chips { display: flex; flex-wrap: wrap; gap: 6px; }
	.chips button { background: #0f0e0d; border: 1px solid rgba(241,239,233,.14); color: #f1efe9; border-radius: 999px; padding: 6px 11px; font: 12px "DM Sans", sans-serif; }
	.chips button:hover { border-color: #ff8a72; color: #ff8a72; }
	form { display: flex; gap: 8px; padding: 12px 16px max(16px, env(safe-area-inset-bottom)); border-top: 1px solid rgba(241,239,233,.08); }
	input { flex: 1; background: #161514; border: 1px solid rgba(241,239,233,.14); border-radius: 999px; padding: 11px 16px; color: #f1efe9; font: 14px "DM Sans", sans-serif; outline: none; }
	input:focus { border-color: rgba(255,138,114,.6); }
	form button { width: 42px; height: 42px; border-radius: 50%; border: 0; background: #ff8a72; color: #161514; font-size: 18px; font-weight: 600; }
	@media (max-width: 700px) {
		.panel { top: auto; left: 0; right: 0; width: auto; height: 52vh; border-left: 0; border-top: 1px solid rgba(241,239,233,.1); border-radius: 18px 18px 0 0; transition: height .25s ease; }
		.panel.collapsed { height: 112px; } .panel.collapsed .log { display: none; }
		.handle { display: block; background: none; border: 0; padding: 10px 0 0; }
		.handle span { display: block; width: 36px; height: 4px; border-radius: 2px; background: rgba(241,239,233,.25); margin: 0 auto; }
		header { padding-top: 8px; }
	}
</style>
