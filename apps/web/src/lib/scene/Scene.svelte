<script lang="ts">
  // Camera, controls, idle drift and click-to-focus around the constellation. docs/spec/scene.md.
  import { T, useTask, useThrelte } from '@threlte/core';
  import { CameraControls, interactivity } from '@threlte/extras';
  import type CC from 'camera-controls';
  import GraphMesh from './GraphMesh.svelte';
  import { relayout } from './relayout.ts';
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

  let controls = $state<CC | undefined>();
  let idle = true;
  const stopIdle = () => {
    idle = false;
  };
  const created = (c: CC) => {
    controls = c;
    c.addEventListener('controlstart', stopIdle);
  };
  const { invalidate } = useThrelte();
  useTask((dt) => {
    if (idle && controls) {
      controls.azimuthAngle += dt * 0.05;
      invalidate();
    }
  });

  $effect(() => {
    if (focus == null || !controls) return;
    idle = false;
    const p = positions;
    controls.moveTo(p[focus * 3] ?? 0, p[focus * 3 + 1] ?? 0, p[focus * 3 + 2] ?? 0, true);
    controls.dollyTo(Math.min(controls.distance, 14), true);
    invalidate();
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, 6 * zoom, 30 * zoom]} fov={50}>
  <CameraControls smoothTime={0.3} minDistance={6} maxDistance={70} oncreate={created} />
</T.PerspectiveCamera>

<GraphMesh {graph} {positions} {subgraph} {preview} {onpick} />
