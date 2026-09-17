<script lang="ts">
	// PROTOTYPE "Floating card": Scene full-bleed, current Answer as one card bottom-left, pill input bar.
	// Suggestions (idle hints or followups) sit above the bar; hovering one previews it.
	import Answer from './Answer.svelte';
	import type { ChatProps, Cite } from './chat';
	let { messages, suggestions, attract, streaming, onsend, onpreview, oncite, oninput, focused, chips = false }: ChatProps = $props();
	let draft = $state('');
	let showHistory = $state(false);
	const answers = $derived(messages.filter((m) => m.role === 'answer'));
	const current = $derived(answers.at(-1));
	const lastPrompt = $derived([...messages].reverse().find((m) => m.role === 'visitor'));
	const cites = $derived((current?.parts.filter((p) => p.kind === 'cite') ?? []) as Cite[]);
	function send(p = draft) { if (!p.trim()) return; onsend(p.trim()); draft = ''; }
	$effect(() => { oninput(draft.length > 0); });
</script>

{#if current}
	<article class="card" class:suggested={lastPrompt?.suggested}>
		<header>
			<span class="q">{lastPrompt?.suggested ? '✦ ' : ''}{lastPrompt?.parts[0].kind === 'text' ? lastPrompt.parts[0].text : ''}</span>
			{#if answers.length > 1}<button class="hist" onclick={() => (showHistory = !showHistory)}>{answers.length - 1} earlier</button>{/if}
		</header>
		<div class="body">
			<Answer parts={current.parts} {oncite} {focused} />{#if current.streaming}<span class="caret"></span>{/if}
			{#if current.error}<div class="err">{current.error}</div>{/if}
		</div>
		{#if chips && cites.length}
			<div class="cites">
				{#each cites as c (c.ordinal)}<button class:focused={focused === c.nodeId} onclick={() => oncite(c.nodeId)}><i>{c.ordinal + 1}</i>{c.title}</button>{/each}
			</div>
		{/if}
	</article>
	{#if showHistory}
		<div class="history">{#each answers.slice(0, -1) as a, i (i)}<div class="h"><Answer parts={a.parts} {oncite} {focused} compact /></div>{/each}</div>
	{/if}
{/if}

<div class="dock">
	{#if suggestions.length && !streaming}
		<div class="sugg" class:attract>
			{#if attract}<span class="k">Try asking</span>{/if}
			{#each suggestions as s (s)}<button onmouseenter={() => onpreview(s)} onfocus={() => onpreview(s)} onclick={() => send(s)}>{s}</button>{/each}
		</div>
	{/if}
	<form class="bar" onsubmit={(e) => { e.preventDefault(); send(); }}>
		<span class="dot" class:live={streaming}></span>
		<input bind:value={draft} placeholder="Ask about Pavel, or paste a job description" onfocus={() => oninput(true)} onblur={() => oninput(draft.length > 0)} />
		<button type="submit">Ask</button>
	</form>
</div>

<style>
	.card {
		position: fixed; left: 16px; bottom: 132px; width: min(460px, calc(100vw - 32px)); max-height: 46vh; display: flex; flex-direction: column;
		background: rgba(15,14,13,.86); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
		border: 1px solid rgba(241,239,233,.12); border-radius: 16px; color: #f1efe9; z-index: 20; box-shadow: 0 20px 50px rgba(0,0,0,.5);
		animation: rise .3s ease;
	}
	.card.suggested { border-color: rgba(255,138,114,.25); }
	@keyframes rise { from { transform: translateY(10px); opacity: 0; } }
	header { display: flex; justify-content: space-between; gap: 10px; padding: 12px 16px 8px; border-bottom: 1px solid rgba(241,239,233,.08); }
	.q { font: 10px/1.5 "Azeret Mono", monospace; letter-spacing: .1em; text-transform: uppercase; color: #9d9a92; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.hist { background: none; border: 0; color: #ff8a72; font: 11px "DM Sans", sans-serif; white-space: nowrap; }
	.body { padding: 12px 16px; overflow: auto; }
	.caret { display: inline-block; width: 7px; height: 14px; background: #ff8a72; margin-left: 3px; vertical-align: -2px; animation: blink 1s steps(2) infinite; }
	@keyframes blink { to { opacity: 0; } }
	.err { color: #ff8a72; font-size: 12px; margin-top: 6px; }
	.cites { display: flex; gap: 6px; overflow-x: auto; padding: 0 16px 12px; }
	.cites button { flex: none; display: flex; align-items: center; gap: 6px; background: #161514; border: 1px solid rgba(241,239,233,.12); color: #f1efe9; border-radius: 999px; padding: 5px 10px 5px 6px; font: 12px "DM Sans", sans-serif; }
	.cites button i { font: 9px/1 "Azeret Mono", monospace; font-style: normal; width: 16px; height: 16px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,138,114,.18); color: #ff8a72; }
	.cites button.focused, .cites button:hover { border-color: #ff8a72; }
	.history { position: fixed; left: 16px; bottom: calc(132px + 46vh + 8px); width: min(460px, calc(100vw - 32px)); max-height: 30vh; overflow: auto; display: grid; gap: 8px; z-index: 19; }
	.h { background: rgba(15,14,13,.7); border: 1px solid rgba(241,239,233,.08); border-radius: 12px; padding: 10px 14px; opacity: .8; }
	.dock { position: fixed; left: 50%; bottom: max(64px, calc(env(safe-area-inset-bottom) + 64px)); transform: translateX(-50%); width: min(600px, calc(100vw - 32px)); display: grid; gap: 10px; z-index: 21; }
	.sugg { display: flex; gap: 6px; overflow-x: auto; align-items: center; padding-bottom: 2px; }
	.sugg .k { flex: none; font: 10px/1 "Azeret Mono", monospace; letter-spacing: .12em; text-transform: uppercase; color: #9d9a92; margin-right: 4px; }
	.sugg button { flex: none; background: rgba(15,14,13,.8); border: 1px solid rgba(241,239,233,.14); color: #f1efe9; border-radius: 999px; padding: 7px 12px; font: 12px "DM Sans", sans-serif; backdrop-filter: blur(10px); }
	.sugg button:hover { border-color: #ff8a72; color: #ff8a72; }
	.sugg.attract button { animation: pulse 3s ease-in-out infinite; }
	@keyframes pulse { 50% { border-color: rgba(255,138,114,.5); } }
	.bar { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 16px; border-radius: 999px; background: rgba(15,14,13,.9); border: 1px solid rgba(241,239,233,.14); box-shadow: 0 12px 40px rgba(0,0,0,.5); }
	.dot { width: 6px; height: 6px; border-radius: 50%; background: #3a3835; flex: none; } .dot.live { background: #ff8a72; box-shadow: 0 0 10px #ff8a72; }
	input { flex: 1; background: none; border: 0; color: #f1efe9; font: 14px "DM Sans", sans-serif; outline: none; min-width: 0; }
	.bar button { border: 0; background: #ff8a72; color: #161514; border-radius: 999px; padding: 9px 16px; font: 600 13px "DM Sans", sans-serif; }
	@media (max-width: 700px) { .card { left: 12px; right: 12px; width: auto; bottom: 150px; max-height: 38vh; } .history { display: none; } }
</style>
