<script lang="ts">
	// PROTOTYPE Chat variant B: "Floating card". No persistent panel: the Scene stays full-bleed.
	// The current Answer floats as a single card bottom-left (bottom, full-width on mobile); earlier Turns
	// collapse into a small history strip. The input is a bar at the bottom centre.
	import Answer from './Answer.svelte';
	import type { ChatProps } from './chat';
	let { messages, followups, streaming, onsend, oncite, focused }: ChatProps = $props();
	let draft = $state('');
	let showHistory = $state(false);
	const answers = $derived(messages.filter((m) => m.role === 'answer'));
	const current = $derived(answers.at(-1));
	const lastPrompt = $derived([...messages].reverse().find((m) => m.role === 'visitor'));
	function send(p = draft) { if (!p.trim()) return; onsend(p.trim()); draft = ''; }
</script>

{#if current}
	<article class="card">
		<header>
			<span class="q">{lastPrompt?.parts[0].kind === 'text' ? lastPrompt.parts[0].text : ''}</span>
			{#if answers.length > 1}<button class="hist" onclick={() => (showHistory = !showHistory)}>{answers.length - 1} earlier</button>{/if}
		</header>
		<div class="body">
			<Answer parts={current.parts} {oncite} {focused} />{#if current.streaming}<span class="caret"></span>{/if}
			{#if current.error}<div class="err">{current.error}</div>{/if}
		</div>
		{#if followups.length && !streaming}
			<div class="chips">{#each followups as f (f)}<button onclick={() => send(f)}>{f}</button>{/each}</div>
		{/if}
	</article>
	{#if showHistory}
		<div class="history">
			{#each answers.slice(0, -1) as a, i (i)}<div class="h"><Answer parts={a.parts} {oncite} {focused} compact /></div>{/each}
		</div>
	{/if}
{/if}

<form class="bar" onsubmit={(e) => { e.preventDefault(); send(); }}>
	<span class="dot" class:live={streaming}></span>
	<input bind:value={draft} placeholder="Ask about Pavel, or paste a job description" />
	<button type="submit">Ask</button>
</form>

<style>
	.card {
		position: fixed; left: 16px; bottom: 92px; width: min(440px, calc(100vw - 32px)); max-height: 46vh; display: flex; flex-direction: column;
		background: rgba(15,14,13,.86); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
		border: 1px solid rgba(241,239,233,.12); border-radius: 16px; color: #f1efe9; z-index: 20; box-shadow: 0 20px 50px rgba(0,0,0,.5);
		animation: rise .3s ease;
	}
	@keyframes rise { from { transform: translateY(10px); opacity: 0; } }
	header { display: flex; justify-content: space-between; gap: 10px; padding: 12px 16px 8px; border-bottom: 1px solid rgba(241,239,233,.08); }
	.q { font: 10px/1.5 "Azeret Mono", monospace; letter-spacing: .1em; text-transform: uppercase; color: #9d9a92; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.hist { background: none; border: 0; color: #ff8a72; font: 11px "DM Sans", sans-serif; white-space: nowrap; }
	.body { padding: 12px 16px; overflow: auto; }
	.caret { display: inline-block; width: 7px; height: 14px; background: #ff8a72; margin-left: 3px; vertical-align: -2px; animation: blink 1s steps(2) infinite; }
	@keyframes blink { to { opacity: 0; } }
	.err { color: #ff8a72; font-size: 12px; margin-top: 6px; }
	.chips { display: flex; gap: 6px; overflow-x: auto; padding: 0 16px 12px; }
	.chips button { flex: none; background: #0f0e0d; border: 1px solid rgba(241,239,233,.14); color: #f1efe9; border-radius: 999px; padding: 6px 11px; font: 12px "DM Sans", sans-serif; }
	.history { position: fixed; left: 16px; bottom: calc(92px + 46vh + 8px); width: min(440px, calc(100vw - 32px)); max-height: 30vh; overflow: auto; display: grid; gap: 8px; z-index: 19; }
	.h { background: rgba(15,14,13,.7); border: 1px solid rgba(241,239,233,.08); border-radius: 12px; padding: 10px 14px; opacity: .8; }
	.bar {
		position: fixed; left: 50%; bottom: max(76px, calc(env(safe-area-inset-bottom) + 76px)); transform: translateX(-50%); width: min(560px, calc(100vw - 32px));
		display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 16px; border-radius: 999px; z-index: 21;
		background: rgba(15,14,13,.9); border: 1px solid rgba(241,239,233,.14); box-shadow: 0 12px 40px rgba(0,0,0,.5);
	}
	.dot { width: 6px; height: 6px; border-radius: 50%; background: #3a3835; flex: none; } .dot.live { background: #ff8a72; box-shadow: 0 0 10px #ff8a72; }
	input { flex: 1; background: none; border: 0; color: #f1efe9; font: 14px "DM Sans", sans-serif; outline: none; min-width: 0; }
	.bar button { border: 0; background: #ff8a72; color: #161514; border-radius: 999px; padding: 9px 16px; font: 600 13px "DM Sans", sans-serif; }
	@media (max-width: 700px) {
		.card { left: 12px; right: 12px; width: auto; bottom: 132px; max-height: 40vh; }
		.history { display: none; }
	}
</style>
