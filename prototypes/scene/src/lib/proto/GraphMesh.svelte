<script lang="ts">
	// PROTOTYPE shared primitive: one InstancedMesh for all Nodes, one LineSegments for all Edges.
	// Animates position (layout change), scale and colour (highlight delta) every frame with lerp.
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Text, Billboard } from '@threlte/extras';
	import * as THREE from 'three';
	import { TYPE_COLOR, type Graph, type Subgraph } from './graph';

	interface Props {
		graph: Graph;
		positions: Float32Array;
		subgraph: Subgraph | null;
		nodeSize?: number;
		labelSeeds?: boolean;
		onpick?: (index: number) => void;
	}
	let { graph, positions, subgraph, nodeSize = 0.35, labelSeeds = true, onpick }: Props = $props();

	const { invalidate } = useThrelte();
	const n = graph.nodes.length;

	const geometry = new THREE.SphereGeometry(1, 10, 8);
	const material = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 });
	const mesh = new THREE.InstancedMesh(geometry, material, n);
	mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

	// current animated state
	const cur = new Float32Array(positions); // xyz
	const curScale = new Float32Array(n).fill(1);
	const curColor = new Float32Array(n * 3);
	// targets
	const tgtScale = new Float32Array(n).fill(1);
	const tgtColor = new Float32Array(n * 3);
	const tgtPos = $state({ v: positions });

	const dummy = new THREE.Object3D();
	const tmp = new THREE.Color();
	const DIM = new THREE.Color('#2a2f3a');

	// edges
	const edgeGeo = new THREE.BufferGeometry();
	const edgePos = new Float32Array(graph.edges.length * 6);
	const edgeCol = new Float32Array(graph.edges.length * 6);
	edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
	edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3));
	const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
	const edgeTgt = new Float32Array(graph.edges.length * 6);
	const EDGE_DIM = new THREE.Color('#1c202a');
	const EDGE_HI = new THREE.Color('#e9f1ff');
	const EDGE_MID = new THREE.Color('#5a6478');

	function retarget(sg: Subgraph | null) {
		for (let i = 0; i < n; i++) {
			const t = graph.nodes[i].type;
			if (!sg) {
				tmp.set(TYPE_COLOR[t]);
				tgtScale[i] = t === 'person' ? 2 : 1;
			} else if (sg.seeds.has(i)) {
				tmp.set(TYPE_COLOR[t]).multiplyScalar(1.4);
				tgtScale[i] = 2.2;
			} else if (sg.nodes.has(i)) {
				tmp.set(TYPE_COLOR[t]);
				tgtScale[i] = 1.4;
			} else {
				tmp.copy(DIM);
				tgtScale[i] = 0.55;
			}
			tgtColor[i * 3] = tmp.r; tgtColor[i * 3 + 1] = tmp.g; tgtColor[i * 3 + 2] = tmp.b;
		}
		graph.edges.forEach((e, ei) => {
			const c = !sg ? EDGE_MID : sg.edges.has(ei) ? EDGE_HI : EDGE_DIM;
			for (const k of [0, 3]) { edgeTgt[ei * 6 + k] = c.r; edgeTgt[ei * 6 + k + 1] = c.g; edgeTgt[ei * 6 + k + 2] = c.b; }
		});
		invalidate();
	}

	// initialise colours immediately so first frame is not black
	retarget(null);
	curColor.set(tgtColor);
	edgeCol.set(edgeTgt);

	$effect(() => { retarget(subgraph); });
	$effect(() => { tgtPos.v = positions; invalidate(); });

	let settled = false;
	useTask((dt) => {
		const k = 1 - Math.pow(0.001, dt); // ~fast exponential ease
		let moving = false;
		const tp = tgtPos.v;
		for (let i = 0; i < n; i++) {
			for (let c = 0; c < 3; c++) {
				const d = tp[i * 3 + c] - cur[i * 3 + c];
				if (Math.abs(d) > 1e-3) moving = true;
				cur[i * 3 + c] += d * k;
				const dc = tgtColor[i * 3 + c] - curColor[i * 3 + c];
				if (Math.abs(dc) > 1e-3) moving = true;
				curColor[i * 3 + c] += dc * k;
			}
			const ds = tgtScale[i] - curScale[i];
			if (Math.abs(ds) > 1e-3) moving = true;
			curScale[i] += ds * k;
			dummy.position.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]);
			const s = nodeSize * curScale[i];
			dummy.scale.set(s, s, s);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
			mesh.instanceColor!.setXYZ(i, curColor[i * 3], curColor[i * 3 + 1], curColor[i * 3 + 2]);
		}
		mesh.instanceMatrix.needsUpdate = true;
		mesh.instanceColor!.needsUpdate = true;
		mesh.computeBoundingSphere();
		graph.edges.forEach((e, ei) => {
			edgePos[ei * 6] = cur[e.src * 3]; edgePos[ei * 6 + 1] = cur[e.src * 3 + 1]; edgePos[ei * 6 + 2] = cur[e.src * 3 + 2];
			edgePos[ei * 6 + 3] = cur[e.dst * 3]; edgePos[ei * 6 + 4] = cur[e.dst * 3 + 1]; edgePos[ei * 6 + 5] = cur[e.dst * 3 + 2];
			for (let c = 0; c < 6; c++) {
				const d = edgeTgt[ei * 6 + c] - edgeCol[ei * 6 + c];
				if (Math.abs(d) > 1e-3) moving = true;
				edgeCol[ei * 6 + c] += d * k;
			}
		});
		edgeGeo.attributes.position.needsUpdate = true;
		edgeGeo.attributes.color.needsUpdate = true;
		if (moving) { settled = false; invalidate(); } else if (!settled) { settled = true; invalidate(); }
	});

	const seedLabels = $derived(
		labelSeeds && subgraph ? [...subgraph.seeds].slice(0, 12) : []
	);
</script>

<T is={mesh} onclick={(e: any) => e.instanceId != null && onpick?.(e.instanceId)} />
<T.LineSegments geometry={edgeGeo} material={edgeMat} />

{#each seedLabels as i (i)}
	<Billboard position={[cur[i * 3], cur[i * 3 + 1] + nodeSize * 3, cur[i * 3 + 2]]}>
		<Text text={graph.nodes[i].title} fontSize={0.45} color="#ffffff" anchorX="center" anchorY="bottom"
			outlineWidth={0.03} outlineColor="#000000" />
	</Billboard>
{/each}
