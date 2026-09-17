<script lang="ts">
	// PROTOTYPE Variant C: "Layers". 2.5D stacked planes, one per Node Type, fixed isometric-ish camera.
	// No rotation: pan and zoom only, so it behaves like a map on a phone.
	import { T } from '@threlte/core';
	import { CameraControls, interactivity, Text } from '@threlte/extras';
	import * as THREE from 'three';
	import GraphMesh from './GraphMesh.svelte';
	import { layerLayout, TYPE_COLOR, type Graph, type Subgraph, type NodeType } from './graph';

	interface Props { graph: Graph; subgraph: Subgraph | null; onpick?: (i: number) => void }
	let { graph, subgraph, onpick }: Props = $props();
	interactivity();
	const positions = layerLayout(graph);
	const layers: [NodeType, number, string][] = [
		['domain', 9, 'Domains'], ['organization', 6, 'Organizations'], ['experience', 3, 'Experience'],
		['project', 0, 'Projects'], ['education', -3, 'Education'], ['skill', -6, 'Skills']
	];
</script>

<T.PerspectiveCamera makeDefault position={[0, 22, 34]} fov={40}>
	<CameraControls smoothTime={0.2} minDistance={10} maxDistance={70}
		minPolarAngle={Math.PI * 0.3} maxPolarAngle={Math.PI * 0.3}
		minAzimuthAngle={0} maxAzimuthAngle={0}
		truckSpeed={2} />
</T.PerspectiveCamera>
<T.AmbientLight intensity={1} />
<T.DirectionalLight position={[5, 30, 20]} intensity={0.8} />

{#each layers as [type, y, label] (type)}
	<T.Mesh position.y={y - 0.3} rotation.x={-Math.PI / 2}>
		<T.PlaneGeometry args={[type === 'skill' ? 20 : type === 'project' ? 16 : 12, type === 'skill' ? 12 : 8]} />
		<T.MeshBasicMaterial color={TYPE_COLOR[type]} transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
	</T.Mesh>
	<Text text={label} position={[-(type === 'skill' ? 10 : type === 'project' ? 8 : 6) - 0.5, y, 0]}
		fontSize={0.7} color={TYPE_COLOR[type]} anchorX="right" rotation.x={-Math.PI / 2} />
{/each}

<GraphMesh {graph} {positions} {subgraph} {onpick} nodeSize={0.3} />
