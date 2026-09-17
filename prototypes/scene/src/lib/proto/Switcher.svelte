<script lang="ts">
	// PROTOTYPE switcher: floating bottom bar cycling ?variant=. Hidden in production builds.
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	interface Props { variants: { key: string; name: string }[]; current: string }
	let { variants, current }: Props = $props();

	const idx = $derived(Math.max(0, variants.findIndex((v) => v.key === current)));
	function go(delta: number) {
		const next = variants[(idx + delta + variants.length) % variants.length].key;
		const url = new URL(page.url);
		url.searchParams.set('variant', next);
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}
	function onkey(e: KeyboardEvent) {
		const t = e.target as HTMLElement | null;
		if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
		if (e.key === 'ArrowLeft') go(-1);
		if (e.key === 'ArrowRight') go(1);
	}
</script>

<svelte:window onkeydown={onkey} />

{#if dev}
	<div class="bar">
		<button onclick={() => go(-1)} aria-label="previous variant">◀</button>
		<span>{variants[idx].key} · {variants[idx].name}</span>
		<button onclick={() => go(1)} aria-label="next variant">▶</button>
	</div>
{/if}

<style>
	.bar {
		position: fixed; left: 50%; bottom: max(12px, env(safe-area-inset-bottom)); transform: translateX(-50%);
		display: flex; gap: 10px; align-items: center; padding: 8px 12px; border-radius: 999px;
		background: #ff3d81; color: #fff; font: 600 13px system-ui; box-shadow: 0 6px 20px rgba(0,0,0,.5);
		z-index: 50; white-space: nowrap;
	}
	button { background: #fff2; border: 0; color: #fff; border-radius: 999px; width: 32px; height: 32px; font-size: 14px; }
</style>
