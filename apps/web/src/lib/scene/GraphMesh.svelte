<script lang="ts">
  // The "Ember" constellation renderer from the prototype: Nodes are one shader-drawn Points object
  // (smoothstep core + gaussian halo), Edges are additive hairlines, plus a static dust field.
  // No lights, no spheres, no postprocessing. docs/spec/scene.md.
  import { T, useTask, useThrelte } from '@threlte/core';
  import { Billboard, Text } from '@threlte/extras';
  import * as THREE from 'three';
  import { PALETTE, type SceneGraph, type Subgraph } from './types.ts';

  interface Props {
    graph: SceneGraph;
    positions: Float32Array;
    subgraph: Subgraph | null;
    /** Faint tier without seeds: the hint preview. */
    preview: ReadonlySet<number> | null;
    onpick?: ((index: number) => void) | undefined;
  }
  let { graph, positions, subgraph, preview, onpick }: Props = $props();

  const { invalidate, scene } = useThrelte();
  scene.fog = new THREE.FogExp2(PALETTE.bg, 0.016);
  const n = graph.nodes.length;

  const DIM = new THREE.Color(PALETTE.dim);
  const REST_C = new THREE.Color(PALETTE.rest);
  const PERSON_C = new THREE.Color(PALETTE.person);
  const SEED_C = new THREE.Color(PALETTE.seed);
  const FAINT_C = new THREE.Color(PALETTE.faint);

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
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
    uniforms: {
      uDpr: { value: 1 },
      uHaloK: { value: 2.6 },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    },
    vertexShader: `
      attribute vec3 aColor; attribute float aSize; attribute float aGlow;
      varying vec3 vColor; varying float vGlow;
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
      uniform float uHaloK;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = gl_PointCoord - 0.5; float d = length(p) * 2.0;
        float core = smoothstep(0.30, 0.12, d);
        float halo = exp(-d * d * uHaloK) * vGlow;
        float a = core + halo * 0.55;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor * (0.9 * core + 0.8 * halo), a);
        #include <fog_fragment>
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  const DUST = 700;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  let s = 99;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (rnd() - 0.5) * 70;
    dustPos[i * 3 + 1] = (rnd() - 0.5) * 40;
    dustPos[i * 3 + 2] = (rnd() - 0.5) * 70;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: PALETTE.dust,
    size: 0.06,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;

  const tgtColor = new Float32Array(n * 3);
  const tgtSize = new Float32Array(n);
  const tgtGlow = new Float32Array(n);
  let tgtPos = positions;
  const tmp = new THREE.Color();

  const edgeGeo = new THREE.BufferGeometry();
  const edgePos = new Float32Array(graph.edges.length * 6);
  const edgeCol = new Float32Array(graph.edges.length * 6);
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
  edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeCol, 3));
  const edgeMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
  });
  const edgeTgt = new Float32Array(graph.edges.length * 6);
  const EDGE_DIM = new THREE.Color(PALETTE.edgeDim);
  const EDGE_REST = new THREE.Color(PALETTE.edgeRest);
  const EDGE_HI = new THREE.Color(PALETTE.edgeHi);

  function retarget(sg: Subgraph | null, pv: ReadonlySet<number> | null) {
    for (let i = 0; i < n; i++) {
      const node = graph.nodes[i];
      const isPerson = node?.type === 'person';
      const deg = Math.min(1, (node?.degree ?? 0) / 12);
      let size = 0;
      let glow = 0;
      if (sg) {
        if (sg.seeds.has(i)) {
          tmp.copy(SEED_C);
          size = 3.0;
          glow = 1.8;
        } else if (sg.nodes.has(i)) {
          tmp.copy(isPerson ? PERSON_C : FAINT_C);
          size = isPerson ? 2.2 : 1.05;
          glow = isPerson ? 0.6 : 0.25;
        } else {
          tmp.copy(DIM);
          size = 0.55;
        }
      } else if (pv) {
        if (pv.has(i) || isPerson) {
          tmp.copy(isPerson ? PERSON_C : FAINT_C);
          size = isPerson ? 2.4 : 1.15;
          glow = isPerson ? 0.9 : 0.45;
        } else {
          tmp.copy(REST_C).lerp(DIM, 0.55);
          size = 0.7 + deg * 0.4;
          glow = 0.15;
        }
      } else {
        tmp.copy(isPerson ? PERSON_C : REST_C);
        size = isPerson ? 2.4 : 0.8 + deg * 0.6;
        glow = isPerson ? 0.9 : 0.35;
      }
      tgtColor[i * 3] = tmp.r;
      tgtColor[i * 3 + 1] = tmp.g;
      tgtColor[i * 3 + 2] = tmp.b;
      tgtSize[i] = size;
      tgtGlow[i] = glow;
    }
    graph.edges.forEach((_, ei) => {
      const c = !sg ? EDGE_REST : sg.edges.has(ei) ? EDGE_HI : EDGE_DIM;
      for (const k of [0, 3]) {
        edgeTgt[ei * 6 + k] = c.r;
        edgeTgt[ei * 6 + k + 1] = c.g;
        edgeTgt[ei * 6 + k + 2] = c.b;
      }
    });
    invalidate();
  }
  retarget(null, null);
  colorAttr.set(tgtColor);
  sizeAttr.set(tgtSize);
  glowAttr.set(tgtGlow);
  edgeCol.set(edgeTgt);

  $effect(() => {
    retarget(subgraph, preview);
  });
  $effect(() => {
    tgtPos = positions;
    invalidate();
  });

  let settled = false;
  useTask((dt) => {
    // Every animated quantity lerps with k = 1 − 0.002^dt (about 0.6 s to settle).
    const k = 1 - Math.pow(0.002, dt);
    let moving = false;
    const tp = tgtPos;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        const d = (tp[i * 3 + c] ?? 0) - (cur[i * 3 + c] ?? 0);
        if (Math.abs(d) > 1e-3) moving = true;
        cur[i * 3 + c] = (cur[i * 3 + c] ?? 0) + d * k;
        const dc = (tgtColor[i * 3 + c] ?? 0) - (colorAttr[i * 3 + c] ?? 0);
        if (Math.abs(dc) > 1e-3) moving = true;
        colorAttr[i * 3 + c] = (colorAttr[i * 3 + c] ?? 0) + dc * k;
      }
      const ds = (tgtSize[i] ?? 0) - (sizeAttr[i] ?? 0);
      if (Math.abs(ds) > 1e-3) moving = true;
      sizeAttr[i] = (sizeAttr[i] ?? 0) + ds * k;
      const dg = (tgtGlow[i] ?? 0) - (glowAttr[i] ?? 0);
      if (Math.abs(dg) > 1e-3) moving = true;
      glowAttr[i] = (glowAttr[i] ?? 0) + dg * k;
    }
    geo.attributes.position!.needsUpdate = true;
    geo.attributes.aColor!.needsUpdate = true;
    geo.attributes.aSize!.needsUpdate = true;
    geo.attributes.aGlow!.needsUpdate = true;
    graph.edges.forEach((e, ei) => {
      edgePos[ei * 6] = cur[e.source * 3] ?? 0;
      edgePos[ei * 6 + 1] = cur[e.source * 3 + 1] ?? 0;
      edgePos[ei * 6 + 2] = cur[e.source * 3 + 2] ?? 0;
      edgePos[ei * 6 + 3] = cur[e.target * 3] ?? 0;
      edgePos[ei * 6 + 4] = cur[e.target * 3 + 1] ?? 0;
      edgePos[ei * 6 + 5] = cur[e.target * 3 + 2] ?? 0;
      for (let c = 0; c < 6; c++) {
        const d = (edgeTgt[ei * 6 + c] ?? 0) - (edgeCol[ei * 6 + c] ?? 0);
        if (Math.abs(d) > 1e-3) moving = true;
        edgeCol[ei * 6 + c] = (edgeCol[ei * 6 + c] ?? 0) + d * k;
      }
    });
    edgeGeo.attributes.position!.needsUpdate = true;
    edgeGeo.attributes.color!.needsUpdate = true;
    if (moving) {
      settled = false;
      invalidate();
    } else if (!settled) {
      settled = true;
      invalidate();
    }
  });

  function pick(e: { index?: number }) {
    if (onpick && e.index != null) onpick(e.index);
  }
  function raycast(r: THREE.Raycaster, hits: THREE.Intersection[]) {
    r.params.Points = { threshold: 0.6 };
    points.raycast(r, hits);
  }

  const seedLabels = $derived(subgraph ? [...subgraph.seeds].slice(0, 12) : []);
  let labelPos = $state<Record<number, [number, number, number]>>({});
  useTask(() => {
    if (!seedLabels.length) return;
    const next: Record<number, [number, number, number]> = {};
    for (const i of seedLabels)
      next[i] = [cur[i * 3] ?? 0, (cur[i * 3 + 1] ?? 0) + 1.1, cur[i * 3 + 2] ?? 0];
    labelPos = next;
  });
  const labelAt = (i: number): [number, number, number] =>
    labelPos[i] ?? [cur[i * 3] ?? 0, (cur[i * 3 + 1] ?? 0) + 1.1, cur[i * 3 + 2] ?? 0];

  $effect(() => {
    mat.uniforms.uDpr!.value = Math.min(window.devicePixelRatio, 2);
  });

  export function currentPosition(i: number): [number, number, number] {
    return [cur[i * 3] ?? 0, cur[i * 3 + 1] ?? 0, cur[i * 3 + 2] ?? 0];
  }
</script>

<T is={dust} />
<T.LineSegments geometry={edgeGeo} material={edgeMat} />
<T is={points} onclick={pick} {raycast} />

{#each seedLabels as i (i)}
  <Billboard position={labelAt(i)}>
    <Text
      text={graph.nodes[i]?.title ?? ''}
      fontSize={0.38}
      color={PALETTE.person}
      anchorX="center"
      anchorY="bottom"
      fillOpacity={0.9}
      outlineWidth={0.015}
      outlineColor={PALETTE.bg}
      outlineOpacity={0.8}
    />
  </Billboard>
{/each}
