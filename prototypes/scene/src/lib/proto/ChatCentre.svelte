<script lang="ts">
	// PROTOTYPE "Centred" chat: the Answer block and the prompt field are both centred horizontally.
	// layout: 'top' = field on top, answer strip below it; 'bottom' = answer caption above a bottom field;
	// 'middle' = answer column dead-centre with the field under it. Hints cycle as ghost text in the field;
	// submitting an empty field plays the hint shown.
	import Answer from './Answer.svelte';
	import type { ChatProps, Cite } from './chat';
	let { messages, followups, hint, attract, streaming, onsend, onplayhint, oncite, oninput, focused, layout }: ChatProps = $props();
	let draft = $state('');
	let open = $state(false);
	const current = $derived(messages.filter((m) => m.role === 'answer').at(-1));
	const lastPrompt = $derived([...messages].reverse().find((m) => m.role === 'visitor'));
	const cites = $derived((current?.parts.filter((p) => p.kind === 'cite') ?? []) as Cite[]);
	function submit() {
		if (draft.trim()) { onsend(draft.trim()); draft = ''; open = false; }
		else onplayhint();
	}
	$effect(() => { oninput(draft.length > 0); });
</script>

{#snippet field()}
	<form class="field" onsubmit={(e) => { e.preventDefault(); submit(); }}>
		<span class="mark" class:live={streaming}>›</span>
		<div class="inputwrap">
			{#if !draft}<span class="ghost" class:attract>{#key hint}<span class="cycle">{hint}</span>{/key}</span>{/if}
			<input bind:value={draft} aria-label="prompt" onfocus={() => oninput(true)} onblur={() => oninput(draft.length > 0)} />
		</div>
		<button type="submit" aria-label="send">{draft ? '↵' : '▶'}</button>
	</form>
{/snippet}

{#snippet answer()}
	{#if current}
		<section class="answer" class:open class:suggested={lastPrompt?.suggested}>
			<div class="q">
				<span>{lastPrompt?.suggested ? '✦ ' : ''}{lastPrompt?.parts[0].kind === 'text' ? lastPrompt.parts[0].text : ''}</span>
				{#if layout !== 'middle'}<button class="toggle" onclick={() => (open = !open)} aria-label="expand answer">{open ? '−' : '+'}</button>{/if}
			</div>
			<div class="text"><Answer parts={current.parts} {oncite} {focused} compact={layout === 'top'} />{#if current.streaming}<span class="caret"></span>{/if}</div>
			{#if cites.length}
				<div class="cites">{#each cites as c (c.ordinal)}<button class:focused={focused === c.nodeId} onclick={() => oncite(c.nodeId)}><i>{c.ordinal + 1}</i>{c.title}</button>{/each}</div>
			{/if}
			{#if followups.length && !streaming}
				<div class="follow">{#each followups as f (f)}<button onclick={() => onsend(f)}>{f}</button>{/each}</div>
			{/if}
		</section>
	{/if}
{/snippet}

<div class="col {layout}">
	{#if layout === 'top'}{@render field()}{@render answer()}
	{:else if layout === 'bottom'}{@render answer()}{@render field()}
	{:else}{@render answer()}{@render field()}{/if}
</div>

<style>
	.col { position: fixed; left: 12px; right: 12px; margin: 0 auto; max-width: 680px; display: grid; gap: 10px; z-index: 20; color: #f1efe9; }
	.col.top { top: 44px; }
	.col.bottom { bottom: max(64px, calc(env(safe-area-inset-bottom) + 64px)); }
	.col.middle { top: 50%; transform: translateY(-50%); }
	.field { display: flex; align-items: center; gap: 10px; padding: 6px 6px 6px 16px; border-radius: 999px; background: rgba(15,14,13,.88); border: 1px solid rgba(241,239,233,.14); box-shadow: 0 12px 40px rgba(0,0,0,.45); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
	.mark { color: #9d9a92; font: 16px "Azeret Mono", monospace; } .mark.live { color: #ff8a72; }
	.inputwrap { position: relative; flex: 1; min-width: 0; height: 36px; display: flex; align-items: center; }
	input { position: relative; width: 100%; background: none; border: 0; color: #f1efe9; font: 15px "DM Sans", sans-serif; outline: none; z-index: 1; }
	.ghost { position: absolute; inset: 0; display: flex; align-items: center; color: #9d9a92; font: 15px "DM Sans", sans-serif; pointer-events: none; overflow: hidden; white-space: nowrap; }
	.ghost.attract { color: #bdb9b0; }
	.cycle { display: inline-block; animation: fadein .5s ease; }
	@keyframes fadein { from { opacity: 0; transform: translateY(4px); } }
	.field button { width: 36px; height: 36px; border-radius: 50%; border: 0; background: #ff8a72; color: #161514; font-size: 13px; font-weight: 600; flex: none; }
	.answer { background: rgba(15,14,13,.82); border: 1px solid rgba(241,239,233,.1); border-radius: 14px; padding: 12px 16px; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); animation: rise .3s ease; display: grid; gap: 8px; }
	.answer.suggested { border-color: rgba(255,138,114,.22); }
	@keyframes rise { from { transform: translateY(6px); opacity: 0; } }
	.q { display: flex; justify-content: space-between; gap: 10px; font: 10px/1.6 "Azeret Mono", monospace; letter-spacing: .1em; text-transform: uppercase; color: #9d9a92; }
	.q span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.toggle { flex: none; width: 22px; height: 22px; border-radius: 6px; border: 1px solid rgba(241,239,233,.14); background: none; color: #9d9a92; }
	.top .text { max-height: 4.8em; overflow: hidden; mask-image: linear-gradient(#000 65%, transparent); }
	.bottom .text { max-height: 9em; overflow: hidden; mask-image: linear-gradient(#000 75%, transparent); }
	.answer.open .text { max-height: 50vh; overflow: auto; mask-image: none; }
	.middle .text { max-height: 40vh; overflow: auto; }
	.caret { display: inline-block; width: 6px; height: 12px; background: #ff8a72; margin-left: 3px; animation: blink 1s steps(2) infinite; }
	@keyframes blink { to { opacity: 0; } }
	.cites { display: flex; gap: 6px; overflow-x: auto; }
	.cites button { flex: none; display: flex; align-items: center; gap: 6px; background: #161514; border: 1px solid rgba(241,239,233,.12); color: #f1efe9; border-radius: 999px; padding: 5px 10px 5px 6px; font: 12px "DM Sans", sans-serif; }
	.cites button i { font: 9px/1 "Azeret Mono", monospace; font-style: normal; width: 16px; height: 16px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,138,114,.18); color: #ff8a72; }
	.cites button.focused, .cites button:hover { border-color: #ff8a72; }
	.follow { display: flex; gap: 6px; overflow-x: auto; }
	.follow button { flex: none; background: none; border: 1px solid rgba(241,239,233,.14); color: #9d9a92; border-radius: 999px; padding: 5px 10px; font: 12px "DM Sans", sans-serif; }
	.follow button:hover { color: #ff8a72; border-color: #ff8a72; }
	@media (max-width: 700px) { .col.top { top: 84px; } .col.middle { top: 46%; } }
</style>
