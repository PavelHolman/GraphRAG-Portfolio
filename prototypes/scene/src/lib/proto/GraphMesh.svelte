<script lang="ts">
	// PROTOTYPE shared primitive (iteration 3, "constellation" pass): Nodes are shader-drawn points with
	// a soft gaussian falloff and per-point glow (one draw call), Edges are hairlines, plus a static dust
	// field. No spheres, no lighting: the look of the reference hero.
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Text, Billboard } from '@threlte/extras';
	import * as THREE from 'three';
	import type { Graph, Subgraph } from './graph';

	interface Props {
		graph: Graph;
		positions: Float32Array;
		subgraph: Subgraph | null;
		labelSeeds?: boolean;
		onpick?: (index: number) => void;
	}
	let { graph, positions, subgraph, labelSeeds = true, onpick }: Props = $props();

	const { invalidate, scene } = useThrelte();
	scene.fog = new THREE.FogExp2('#161514', 0.016);
	const n = graph.nodes.length;

	// Poqet palette
	const DIM = new THREE.Color('#4a4743');
	const REST_C = new THREE.Color('#d6d2c9');
	const PERSON_C = new THREE.Color('#f1efe9');
	const SEED_C = new THREE.Color('#ff8a72');
	const CITED_C = new THREE.Color('#f1efe9');

	// ---- node points ----
	const geo = new THREE.BufferGeometry();
	const cur = new Float32Array(positions);
	const colorAttr = new Float32Array(n * 3);
	const sizeAttr = new Float32Array(n);
	const glowAttr = new Float32Array(n);
	geo.setAttribute('position', new THREE.BufferAttribute(cur, 3));
	geo.setAttribute('aColor', new THREE.BufferAttribute(colorAttr, 3));
	geo.setAttribute('aSize', new THREE.BufferAttribute(sizeAttr, 1));
	geo.setAttribute('aGlow', new THREE.BufferAttribute(glowAttr, 1));

	const mat = new THREE.ShaderMaterial({
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
		uniforms: { uDpr: { value: 1 }, ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog) },
		vertexShader: `
			attribute vec3 aColor; attribute float aSize; attribute float aGlow;
			varying vec3 vColor; varying float vGlow; varying float vFog;
			uniform float uDpr;
			#include <fog_pars_vertex>
			void main() {
				vColor = aColor; vGlow = aGlow;
				vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
				gl_PointSize = aSize * uDpr * (520.0 / -mvPosition.z);
				gl_Position = projectionMatrix * mvPosition;
				#include <fog_vertex>
			}`,
		fragmentShader: `
			varying vec3 vColor; varying float vGlow;
			#include <fog_pars_fragment>
			void main() {
				vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0;
				float core = smoothstep(0.30, 0.12, d);
				float halo = exp(-d * d * 2.6) * vGlow;
				float a = core + halo * 0.55;
				if (a < 0.01) discard;
				gl_FragColor = vec4(vColor * (0.9 * core + 0.8 * halo), a);
				#include <fog_fragment>
			}`
	});
	const points = new THREE.Points(geo, mat);
	points.frustumCulled = false;

	// ---- dust field (static, very faint) ----
	const DUST = 700;
	const dustGeo = new THREE.BufferGeometry();
	const dustPos = new Float32Array(DUST * 3);
	let s = 99;
	const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
	for (let i = 0; i < DUST; i++) {
		dustPos[i * 3] = (rnd() - 0.5) * 70; dustPos[i * 3 + 1] = (rnd() - 0.5) * 40; dustPos[i * 3 + 2] = (rnd() - 0.5) * 70;
	}
	dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
	const dustMat = new THREE.PointsMaterial({ color: '#6b6761', size: 0.06, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
	const dust = new THREE.Points(dustGeo, dustMat);
	dust.frustumCulled = false;

	// ---- animated targets ----
	const tgtColor = new Float32Array(n * 3);
	const tgtSize = new Float32Array(n);
	const tgtGlow = new Float32Array(n);
	const tgtPos = $state({ v: positions });
	const tmp = new THREE.Color();

	// ---- edges ----
	const edgeGeo = new THREE.BufferGeometry();
	const edgePos = new Float32Array(graph.edges.length * 6);
	const edgeCol = new Float32Array(graph.edges.length * 6);
	edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
	edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3));
	const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
	const edgeTgt = new Float32Array(graph.edges.length * 6);
	const EDGE_DIM = new THREE.Color('#1a1816');
	const EDGE_REST = new THREE.Color('#242220');
	const EDGE_HI = new THREE.Color('#8a5f54');

	function retarget(sg: Subgraph | null) {
		for (let i = 0; i < n; i++) {
			const t = graph.nodes[i].type;
			const deg = Math.min(1, graph.nodes[i].degree / 12);
			let size = 0, glow = 0;
			if (!sg) {
				tmp.copy(t === 'person' ? PERSON_C : REST_C);
				size = t === 'person' ? 2.4 : 0.8 + deg * 0.6; glow = t === 'person' ? 0.9 : 0.35;
			} else if (sg.seeds.has(i)) {
				tmp.copy(SEED_C); size = 3.0; glow = 1.8;
			} else if (sg.nodes.has(i)) {
				tmp.copy(t === 'person' ? PERSON_C : CITED_C); size = t === 'person' ? 2.6 : 1.7; glow = 0.7;
			} else {
				tmp.copy(DIM); size = 0.55; glow = 0;
			}
			tgtColor[i * 3] = tmp.r; tgtColor[i * 3 + 1] = tmp.g; tgtColor[i * 3 + 2] = tmp.b;
			tgtSize[i] = size; tgtGlow[i] = glow;
		}
		graph.edges.forEach((e, ei) => {
			const c = !sg ? EDGE_REST : sg.edges.has(ei) ? EDGE_HI : EDGE_DIM;
			for (const k of [0, 3]) { edgeTgt[ei * 6 + k] = c.r; edgeTgt[ei * 6 + k + 1] = c.g; edgeTgt[ei * 6 + k + 2] = c.b; }
		});
		invalidate();
	}
	retarget(null);
	colorAttr.set(tgtColor); sizeAttr.set(tgtSize); glowAttr.set(tgtGlow); edgeCol.set(edgeTgt);

	$effect(() => { retarget(subgraph); });
	$effect(() => { tgtPos.v = positions; invalidate(); });

	let settled = false;
	useTask((dt) => {
		const k = 1 - Math.pow(0.002, dt);
		let moving = false;
		const tp = tgtPos.v;
		for (let i = 0; i < n; i++) {
			for (let c = 0; c < 3; c++) {
				const d = tp[i * 3 + c] - cur[i * 3 + c]; if (Math.abs(d) > 1e-3) moving = true; cur[i * 3 + c] += d * k;
				const dc = tgtColor[i * 3 + c] - colorAttr[i * 3 + c]; if (Math.abs(dc) > 1e-3) moving = true; colorAttr[i * 3 + c] += dc * k;
			}
			const ds = tgtSize[i] - sizeAttr[i]; if (Math.abs(ds) > 1e-3) moving = true; sizeAttr[i] += ds * k;
			const dg = tgtGlow[i] - glowAttr[i]; if (Math.abs(dg) > 1e-3) moving = true; glowAttr[i] += dg * k;
		}
		geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true;
		geo.attributes.aSize.needsUpdate = true; geo.attributes.aGlow.needsUpdate = true;
		graph.edges.forEach((e, ei) => {
			edgePos[ei * 6] = cur[e.src * 3]; edgePos[ei * 6 + 1] = cur[e.src * 3 + 1]; edgePos[ei * 6 + 2] = cur[e.src * 3 + 2];
			edgePos[ei * 6 + 3] = cur[e.dst * 3]; edgePos[ei * 6 + 4] = cur[e.dst * 3 + 1]; edgePos[ei * 6 + 5] = cur[e.dst * 3 + 2];
			for (let c = 0; c < 6; c++) { const d = edgeTgt[ei * 6 + c] - edgeCol[ei * 6 + c]; if (Math.abs(d) > 1e-3) moving = true; edgeCol[ei * 6 + c] += d * k; }
		});
		edgeGeo.attributes.position.needsUpdate = true; edgeGeo.attributes.color.needsUpdate = true;
		if (moving) { settled = false; invalidate(); } else if (!settled) { settled = true; invalidate(); }
	});

	// picking: nearest point to the ray within a threshold
	const raycaster = new THREE.Raycaster();
	raycaster.params.Points = { threshold: 0.6 };
	function pick(e: any) {
		if (!onpick) return;
		const hits = raycaster.intersectObject(points, false);
		void hits; // threlte's interactivity supplies e.index for Points directly
		if (e.index != null) onpick(e.index);
	}

	const seedLabels = $derived(labelSeeds && subgraph ? [...subgraph.seeds].slice(0, 12) : []);
	let labelPos = $state<Record<number, [number, number, number]>>({});
	useTask(() => {
		if (!seedLabels.length) return;
		const next: Record<number, [number, number, number]> = {};
		for (const i of seedLabels) next[i] = [cur[i * 3], cur[i * 3 + 1] + 1.1, cur[i * 3 + 2]];
		labelPos = next;
	});

	$effect(() => { mat.uniforms.uDpr.value = Math.min(window.devicePixelRatio, 2); });
</script>

<T is={dust} />
<T.LineSegments geometry={edgeGeo} material={edgeMat} />
<T is={points} onclick={pick} raycast={(r: THREE.Raycaster, hits: THREE.Intersection[]) => { r.params.Points = { threshold: 0.6 }; points.raycast(r, hits); }} />

{#each seedLabels as i (i)}
	<Billboard position={labelPos[i] ?? [cur[i * 3], cur[i * 3 + 1] + 1.1, cur[i * 3 + 2]]}>
		<Text text={graph.nodes[i].title} fontSize={0.38} color="#f1efe9" anchorX="center" anchorY="bottom"
			fillOpacity={0.9} outlineWidth={0.015} outlineColor="#161514" outlineOpacity={0.8} />
	</Billboard>
{/each}
