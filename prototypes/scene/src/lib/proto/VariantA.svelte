<script lang="ts">
	// PROTOTYPE Variant A (iteration 2): force cloud with an answer-time gravity shift.
	// `pull` is the strength of the relayout when a Subgraph is applied: 0 static, 0.45 mild, 0.75 strong.
	import { T, useTask, useThrelte } from '@threlte/core';
	import { CameraControls, interactivity } from '@threlte/extras';
	import type CC from 'camera-controls';
	import GraphMesh from './GraphMesh.svelte';
	import { forceLayout, relayout, type Graph, type Subgraph } from './graph';

	interface Props { graph: Graph; subgraph: Subgraph | null; onpick?: (i: number) => void; zoom?: number; pull?: number }
	let { graph, subgraph, onpick, zoom = 1, pull = 0 }: Props = $props();
	interactivity();
	const base = forceLayout(graph);
	const positions = $derived(relayout(base, subgraph, pull));

	// slow idle drift until the visitor touches the camera
	let controls = $state<CC | undefined>();
	let idle = true;
	const { invalidate } = useThrelte();
	useTask((dt) => {
		if (idle && controls) { controls.azimuthAngle += dt * 0.05; invalidate(); }
	});
</script>

<T.PerspectiveCamera makeDefault position={[0, 6 * zoom, 30 * zoom]} fov={50}>
	<CameraControls bind:ref={controls} smoothTime={0.3} minDistance={6} maxDistance={70}
		oncreate={(c) => c.addEventListener('controlstart', () => (idle = false))} />
</T.PerspectiveCamera>

<GraphMesh {graph} {positions} {subgraph} {onpick} />
