<script lang="ts">
	// PROTOTYPE shared primitive (iteration 2, "modern" pass): unlit flat Nodes with an additive halo
	// layer for the cited Subgraph, hairline additive Edges, depth fog. Still one InstancedMesh per layer.
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
	let { graph, positions, subgraph, nodeSize = 0.3, labelSeeds = true, onpick }: Props = $props();

	const { invalidate, scene } = useThrelte();
	scene.fog = new THREE.FogExp2('#070a12', 0.018);
	const n = graph.nodes.length;

	// core nodes: unlit, vertex-coloured per instance
	const geometry = new THREE.SphereGeometry(1, 12, 10);
	const material = new THREE.MeshBasicMaterial({ toneMapped: false });
	const mesh = new THREE.InstancedMesh(geometry, material, n);
	mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

	// halo layer: larger, additive, back-side so it reads as a soft glow around cited nodes
	const haloMat = new THREE.MeshBasicMaterial({
		transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.BackSide, toneMapped: false, fog: false
	});
	const halo = new THREE.InstancedMesh(geometry, haloMat, n);
	halo.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);

	const cur = new Float32Array(positions);
	const curScale = new Float32Array(n).fill(1);
	const curColor = new Float32Array(n * 3);
	const curHalo = new Float32Array(n); // halo scale multiplier (0 = hidden)
	const tgtScale = new Float32Array(n).fill(1);
	const tgtColor = new Float32Array(n * 3);
	const tgtHalo = new Float32Array(n);
	const tgtPos = $state({ v: positions });

	const dummy = new THREE.Object3D();
	const tmp = new THREE.Color();
	const DIM = new THREE.Color('#1b2130');
	const REST = 0.75; // resting brightness so the idle graph is calm, cited nodes pop

	const edgeGeo = new THREE.BufferGeometry();
	const edgePos = new Float32Array(graph.edges.length * 6);
	const edgeCol = new Float32Array(graph.edges.length * 6);
	edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
	edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3));
	const edgeMat = new THREE.LineBasicMaterial({
		vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
	});
	const edgeTgt = new Float32Array(graph.edges.length * 6);
	const EDGE_DIM = new THREE.Color('#0d1119');
	const EDGE_REST = new THREE.Color('#232a3a');
	const EDGE_HI = new THREE.Color('#9fb4ff');

	function retarget(sg: Subgraph | null) {
		for (let i = 0; i < n; i++) {
			const t = graph.nodes[i].type;
			let haloS = 0;
			if (!sg) {
				tmp.set(TYPE_COLOR[t]).multiplyScalar(REST);
				tgtScale[i] = t === 'person' ? 2 : 1;
			} else if (sg.seeds.has(i)) {
				tmp.set(TYPE_COLOR[t]);
				tgtScale[i] = 2.4; haloS = 2.2;
			} else if (sg.nodes.has(i)) {
				tmp.set(TYPE_COLOR[t]);
				tgtScale[i] = 1.5; haloS = 1.6;
			} else {
				tmp.copy(DIM);
				tgtScale[i] = 0.5;
			}
			tgtColor[i * 3] = tmp.r; tgtColor[i * 3 + 1] = tmp.g; tgtColor[i * 3 + 2] = tmp.b;
			tgtHalo[i] = haloS;
		}
		graph.edges.forEach((e, ei) => {
			const c = !sg ? EDGE_REST : sg.edges.has(ei) ? EDGE_HI : EDGE_DIM;
			for (const k of [0, 3]) { edgeTgt[ei * 6 + k] = c.r; edgeTgt[ei * 6 + k + 1] = c.g; edgeTgt[ei * 6 + k + 2] = c.b; }
		});
		invalidate();
	}

	retarget(null);
	curColor.set(tgtColor);
	edgeCol.set(edgeTgt);

	$effect(() => { retarget(subgraph); });
	$effect(() => { tgtPos.v = positions; invalidate(); });

	let settled = false;
	useTask((dt) => {
		const k = 1 - Math.pow(0.002, dt);
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
			const dh = tgtHalo[i] - curHalo[i];
			if (Math.abs(dh) > 1e-3) moving = true;
			curHalo[i] += dh * k;

			dummy.position.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]);
			const s = nodeSize * curScale[i];
			dummy.scale.set(s, s, s);
			dummy.updateMatrix();
			mesh.setMatrixAt(i, dummy.matrix);
			mesh.instanceColor!.setXYZ(i, curColor[i * 3], curColor[i * 3 + 1], curColor[i * 3 + 2]);

			const hs = s * curHalo[i];
			dummy.scale.set(hs, hs, hs);
			dummy.updateMatrix();
			halo.setMatrixAt(i, dummy.matrix);
			halo.instanceColor!.setXYZ(i, curColor[i * 3], curColor[i * 3 + 1], curColor[i * 3 + 2]);
		}
		mesh.instanceMatrix.needsUpdate = true;
		mesh.instanceColor!.needsUpdate = true;
		halo.instanceMatrix.needsUpdate = true;
		halo.instanceColor!.needsUpdate = true;
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

	const seedLabels = $derived(labelSeeds && subgraph ? [...subgraph.seeds].slice(0, 12) : []);
	// label anchors tracked per frame so labels follow nodes during a relayout
	let labelPos = $state<Record<number, [number, number, number]>>({});
	useTask(() => {
		if (!seedLabels.length) return;
		const next: Record<number, [number, number, number]> = {};
		for (const i of seedLabels) next[i] = [cur[i * 3], cur[i * 3 + 1] + nodeSize * 3.2, cur[i * 3 + 2]];
		labelPos = next;
	});
</script>

<T is={mesh} onclick={(e: any) => e.instanceId != null && onpick?.(e.instanceId)} />
<T is={halo} />
<T.LineSegments geometry={edgeGeo} material={edgeMat} />

{#each seedLabels as i (i)}
	<Billboard position={labelPos[i] ?? [cur[i * 3], cur[i * 3 + 1] + nodeSize * 3.2, cur[i * 3 + 2]]}>
		<Text text={graph.nodes[i].title} fontSize={0.42} color="#f4f6fb" anchorX="center" anchorY="bottom"
			fillOpacity={0.95} outlineWidth={0.02} outlineColor="#070a12" outlineOpacity={0.9} />
	</Billboard>
{/each}
