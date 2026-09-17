<script lang="ts">
  // Camera, controls, idle drift and click-to-focus around the constellation. docs/spec/scene.md.
  import { T, useTask, useThrelte } from '@threlte/core';
  import { CameraControls, interactivity } from '@threlte/extras';
  import type CC from 'camera-controls';
  import { PerspectiveCamera } from 'three';
  import { onMount } from 'svelte';
  import GraphMesh from './GraphMesh.svelte';
  import { centroid, relayout } from './relayout.ts';
  import type { SceneGraph, Subgraph } from './types.ts';

  interface Props {
    graph: SceneGraph;
    subgraph: Subgraph | null;
    preview: ReadonlySet<number> | null;
    focus: number | null;
    portrait: boolean;
    onpick?: ((index: number) => void) | undefined;
  }
  let { graph, subgraph, preview, focus, portrait, onpick }: Props = $props();
  interactivity();
  const positions = $derived(relayout(graph.positions, subgraph));
  const zoom = $derived(portrait ? 1.9 : 1);
  // On wide screens the constellation sits right of centre, beside the intro copy. The canvas stays
  // full width and the graph keeps orbiting its own centre: only the projection is shifted.
  const VIEW_SHIFT = 0.2;
  const { invalidate, renderer, camera, size } = useThrelte();
  $effect(() => {
    const cam = $camera;
    const { width, height } = $size;
    if (!(cam instanceof PerspectiveCamera)) return;
    if (portrait) cam.clearViewOffset();
    else cam.setViewOffset(width, height, -width * VIEW_SHIFT, 0, width, height);
    invalidate();
  });

  // The wheel zooms only a little; at either end of the range the page scrolls instead.
  const MIN_DISTANCE = 18;
  const MAX_DISTANCE = 42;
  const DRIFT = 0.09;

  let controls = $state<CC | undefined>();
  let idle = true;
  // The drift pauses while the visitor holds the camera and resumes a few seconds after they let go.
  const RESUME_AFTER_MS = 1000;
  /** Seconds the drift takes to ease back up to full speed after resuming. */
  const RESUME_RAMP_S = 1;
  let driftRamp = 1;
  let resumeTimer: ReturnType<typeof setTimeout> | undefined;
  const stopIdle = () => {
    idle = false;
    clearTimeout(resumeTimer);
  };
  const scheduleResume = () => {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      idle = true;
      driftRamp = 0;
      invalidate();
    }, RESUME_AFTER_MS);
  };
  const created = (c: CC) => {
    controls = c;
    c.addEventListener('controlstart', stopIdle);
    c.addEventListener('controlend', () => {
      resync();
      scheduleResume();
    });
    // Programmatic moves (focus, the pan to an answer) end with `rest`; the wheel picks up from there.
    c.addEventListener('rest', resync);
  };
  useTask((dt) => {
    if (idle && controls) {
      driftRamp = Math.min(1, driftRamp + dt / RESUME_RAMP_S);
      controls.azimuthAngle += dt * DRIFT * driftRamp * driftRamp;
      invalidate();
    }
  });

  // The camera glides to the Subgraph's centre when a Turn lands; the Nodes only contract in place.
  $effect(() => {
    if (!controls) return;
    const [cx, cy, cz] = centroid(positions, subgraph);
    controls.moveTo(cx, cy, cz, true);
    invalidate();
  });

  $effect(() => {
    if (focus == null || !controls) return;
    stopIdle();
    scheduleResume();
    const p = positions;
    controls.moveTo(p[focus * 3] ?? 0, p[focus * 3 + 1] ?? 0, p[focus * 3 + 2] ?? 0, true);
    // Focus zooms in, but never past the same range the wheel respects.
    controls.dollyTo(Math.max(MIN_DISTANCE * zoom, Math.min(controls.distance, 14)), true);
    invalidate();
  });

  // The wheel is handled here, not by CameraControls: each tick moves an exact target distance
  // within [MIN, MAX] and dollies the camera to it. Only when the target already sits at the outer
  // limit (or the inner one, scrolling up) is the event left alone, so the page scrolls. The zoom
  // is therefore always fully used up before the page moves.
  let wheelDistance = 30 * zoom;
  const WHEEL_RATE = 0.0012;
  const gateWheel = (e: WheelEvent) => {
    if (!controls || e.deltaY === 0) return;
    e.stopPropagation();
    // While the page is scrolled at all, the wheel belongs to the page: scrolling up first brings
    // the Hero fully back into view, and only then does the same gesture start zooming in.
    if (window.scrollY > 0) return;
    const min = MIN_DISTANCE * zoom;
    const max = MAX_DISTANCE * zoom;
    const outward = e.deltaY > 0;
    if ((outward && wheelDistance >= max - 0.01) || (!outward && wheelDistance <= min + 0.01))
      return;
    e.preventDefault();
    wheelDistance = Math.min(max, Math.max(min, wheelDistance * Math.exp(e.deltaY * WHEEL_RATE)));
    controls.dollyTo(wheelDistance, true);
    stopIdle();
    scheduleResume();
    invalidate();
  };
  const resync = () => {
    if (controls) wheelDistance = controls.distance;
  };
  onMount(() => {
    const el = renderer.domElement.parentElement;
    el?.addEventListener('wheel', gateWheel, { capture: true, passive: false });
    return () => {
      el?.removeEventListener('wheel', gateWheel, { capture: true });
      clearTimeout(resumeTimer);
    };
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, 6 * zoom, 30 * zoom]} fov={50}>
  <CameraControls
    smoothTime={0.3}
    minDistance={MIN_DISTANCE * zoom}
    maxDistance={MAX_DISTANCE * zoom}
    dollySpeed={0.6}
    oncreate={created}
  />
</T.PerspectiveCamera>

<GraphMesh {graph} {positions} {subgraph} {preview} {onpick} />
