<script lang="ts">
	// PROTOTYPE Variant A (iteration 2): force cloud with an answer-time gravity shift.
	// `pull` is the strength of the relayout when a Subgraph is applied: 0 static, 0.45 mild, 0.75 strong.
	import { T } from '@threlte/core';
	import { CameraControls, interactivity } from '@threlte/extras';
	import GraphMesh from './GraphMesh.svelte';
	import { forceLayout, relayout, type Graph, type Subgraph } from './graph';

	interface Props { graph: Graph; subgraph: Subgraph | null; onpick?: (i: number) => void; zoom?: number; pull?: number }
	let { graph, subgraph, onpick, zoom = 1, pull = 0 }: Props = $props();
	interactivity();
	const base = forceLayout(graph);
	const positions = $derived(relayout(base, subgraph, pull));
</script>

<T.PerspectiveCamera makeDefault position={[0, 6 * zoom, 30 * zoom]} fov={50}>
	<CameraControls smoothTime={0.3} minDistance={6} maxDistance={70} />
</T.PerspectiveCamera>

<GraphMesh {graph} {positions} {subgraph} {onpick} />
