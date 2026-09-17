<script lang="ts">
	// PROTOTYPE Variant B: "Shells". Designed concentric shells by Node Type, Person at the centre.
	// Camera orbits but polar angle is clamped so the shells always read as rings.
	import { T } from '@threlte/core';
	import { CameraControls, interactivity } from '@threlte/extras';
	import * as THREE from 'three';
	import GraphMesh from './GraphMesh.svelte';
	import { shellLayout, type Graph, type Subgraph } from './graph';

	interface Props { graph: Graph; subgraph: Subgraph | null; onpick?: (i: number) => void; zoom?: number }
	let { graph, subgraph, onpick, zoom = 1 }: Props = $props();
	interactivity();
	const positions = shellLayout(graph);
	const rings = [4, 6, 8.5, 11, 13];
</script>

<T.PerspectiveCamera makeDefault position={[0 * zoom, 18 * zoom, 30 * zoom]} fov={45}>
	<CameraControls smoothTime={0.25} minDistance={8} maxDistance={60}
		minPolarAngle={Math.PI * 0.15} maxPolarAngle={Math.PI * 0.5} />
</T.PerspectiveCamera>
<T.AmbientLight intensity={0.9} />
<T.DirectionalLight position={[0, 30, 10]} intensity={1} />

<!-- faint guide rings so the shells read even when the graph is dimmed -->
{#each rings as r (r)}
	<T.Mesh rotation.x={-Math.PI / 2}>
		<T.RingGeometry args={[r - 0.02, r + 0.02, 96]} />
		<T.MeshBasicMaterial color="#334" side={THREE.DoubleSide} transparent opacity={0.5} />
	</T.Mesh>
{/each}

<GraphMesh {graph} {positions} {subgraph} {onpick} nodeSize={0.32} />
