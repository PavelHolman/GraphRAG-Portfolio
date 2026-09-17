<script lang="ts">
	// PROTOTYPE Variant A: "Force cloud". Precomputed force layout with cluster gravity, free 3D orbit.
	import { T } from '@threlte/core';
	import { CameraControls, interactivity } from '@threlte/extras';
	import GraphMesh from './GraphMesh.svelte';
	import { forceLayout, type Graph, type Subgraph } from './graph';

	interface Props { graph: Graph; subgraph: Subgraph | null; onpick?: (i: number) => void }
	let { graph, subgraph, onpick }: Props = $props();
	interactivity();
	const positions = forceLayout(graph);
</script>

<T.PerspectiveCamera makeDefault position={[0, 8, 34]} fov={50}>
	<CameraControls smoothTime={0.25} minDistance={6} maxDistance={70} />
</T.PerspectiveCamera>
<T.AmbientLight intensity={0.8} />
<T.DirectionalLight position={[10, 20, 10]} intensity={1.2} />

<GraphMesh {graph} {positions} {subgraph} {onpick} />
