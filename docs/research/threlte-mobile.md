# Threlte on Svelte 5 / SvelteKit and mobile WebGL constraints

Research for GitHub issue #7. Checked against primary sources on 2026-09-17.

## Summary

- Threlte 8 (`@threlte/core` 8.6.0, `@threlte/extras` 9.21.1) is Svelte 5 only (`peerDependencies.svelte: ">=5"`), uses runes, callback-prop events (`onclick`) and snippets; Svelte 4 support was dropped in 8.0.0 (Jan 2025).
- Three.js is a peer dependency `>=0.160`; the monorepo develops against `^0.175.0` while three.js itself is at 0.186.0, so pin `three` explicitly and keep `postprocessing` (peer `>=0.168 <0.187`) in range.
- SSR: `<Canvas>` emits a `<div><canvas>` shell on the server and only instantiates the renderer once both elements are bound (`{#if canvas && dom}`), so a scene works under SvelteKit SSR without `browser` guards; `postprocessing` must be listed in `vite.config` `ssr.noExternal`. Use one `<Canvas>` per app (browsers cap active WebGL contexts).
- Extras cover the graph scene: `<InstancedMesh>`/`<Instance>` (one draw call for all nodes, per-instance events), `<Text>` (troika SDF), `<HTML>` overlays, `interactivity()` raycast events with a `touch-action: none` note, `<CameraControls>` (yomotsu camera-controls, touch mappings) or `<OrbitControls>`, and the `bvh()` plugin for cheap raycasts. Postprocessing is done by `autoRender={false}` plus `useTask` with pmndrs `postprocessing`; there is no `@threlte/postprocessing` package.
- Mobile hard limits: `linewidth` is ignored in WebGL (always 1 px) so thick edges need `LineSegments2`/`MeshLine`; cap `dpr` (default is raw `window.devicePixelRatio`, 3x on iPhones = 9x pixels); render on demand; keep textures small (`w*h*4*1.33` bytes each); iOS Safari has a per-page canvas memory budget and a history of "WebGL: context lost" bugs (iOS 17 backgrounding, iOS 18 `flat` qualifier), so handle context loss and keep postprocessing off by default.

## Findings

### 1. Threlte version and Svelte 5 support

- Latest releases: `@threlte/core` 8.6.0 (adds the `@threlte/core/webgpu` export), `@threlte/extras` 9.21.1; `@threlte/extras` 9.21.0 added `useCameraControls`/`useOrbitControls`/`useTrackballControls` hooks. https://github.com/threlte/threlte/releases
- `@threlte/core` `package.json`: `"version": "8.6.0"`, `peerDependencies`: `svelte: ">=5"`, `three: ">=0.160"`. https://github.com/threlte/threlte/blob/main/packages/core/package.json
- `@threlte/extras` `package.json`: `"version": "9.21.1"`, same peers; bundles `troika-three-text ^0.52.4`, `camera-controls ^3.1.2`, `three-mesh-bvh ^0.9.1`, `three-perf ^1.0.11`, `@threejs-kit/instanced-sprite-mesh ^2.5.1`. https://github.com/threlte/threlte/blob/main/packages/extras/package.json
- Migration guide: "Threlte 8 adds Svelte 5 support and removes Svelte 4 support." Events became callback props (`on:click` -> `onclick`), `let:` slot props became snippets (`{#snippet children({ ref })}`), and `oncreate` now returns a cleanup function. https://threlte.xyz/docs/learn/advanced/migration-guides
- `@threlte/core@8.0.0` (20 Jan 2025) release notes list "Experimental Svelte 5 compatibility", AgX as default tone mapping, removal of deep recursive disposal, and a refactored plugin API. https://github.com/threlte/threlte/releases/tag/%40threlte%2Fcore%408.0.0
- The last known runes-mode blocker in extras ("Cannot use `export let` in runes mode") was closed via PR #1490 in Jan 2025. https://github.com/threlte/threlte/issues/1411
- Packages in the monorepo: core, extras, flex, gltf, rapier, studio, theatre, xr. There is no `@threlte/postprocessing` package. https://github.com/threlte/threlte/tree/main/packages

### 2. Three.js version pinning

- Threlte does not pin three.js; it is a peer dep `>=0.160`. The monorepo catalog develops against `three: "^0.175.0"`, `@types/three: "^0.175.0"`, `svelte: "5.53.6"`, `@sveltejs/kit: "^2.37.0"`. https://github.com/threlte/threlte/blob/main/pnpm-workspace.yaml
- Current three.js `package.json` version is `0.186.0`. https://github.com/mrdoob/three.js/blob/dev/package.json
- pmndrs `postprocessing` 6.39.5 has `peerDependencies.three: ">= 0.168.0 < 0.187.0"`. https://github.com/pmndrs/postprocessing/blob/main/package.json
- Installation docs: "`three` and `@threlte/core` are the minimum required"; `@threlte/gltf` components depend on `@threlte/extras`. https://threlte.xyz/docs/learn/getting-started/installation
- Bundle size: the docs link to a maintainer comment noting three.js is hard to tree-shake and suggesting `three-minifier` for Vite. https://github.com/threlte/threlte/issues/8#issuecomment-1024085864

### 3. SSR / SvelteKit handling

- `Canvas.svelte` renders `<div bind:this={dom}><canvas bind:this={canvas}>` unconditionally and mounts `<Context>` (which creates the renderer) only inside `{#if canvas && dom}`. The bound refs are only populated in the browser, so the WebGL renderer is never constructed during SSR. https://github.com/threlte/threlte/blob/main/packages/core/src/lib/Canvas.svelte
- The renderer fragment creates `new WebGLRenderer({ canvas, powerPreference: 'high-performance', antialias: true, alpha: true })` unless `createRenderer` is supplied, computes `dpr` from `devicePixelRatio.current ?? window.devicePixelRatio` clamped by the `[min, max]` tuple if given, and calls `renderer.setPixelRatio(dpr)` in a `$effect.pre`. https://github.com/threlte/threlte/blob/main/packages/core/src/lib/context/fragments/renderer.svelte.ts
- Canvas props: `dpr` (`number | [min, max]`, default `window.devicePixelRatio`), `renderMode` (`'always' | 'on-demand' | 'manual'`, default `'on-demand'`), `autoRender` (default `true`), `createRenderer`, `shadows`, `toneMapping` (default AgX), `colorSpace`. https://threlte.xyz/docs/reference/core/canvas
- App structure: "In a larger Svelte app or when using SvelteKit, prefer a single `<Canvas>` to avoid the WebGL error 'Too many active WebGL contexts.'" The docs show a single `<Canvas>` in `+layout.svelte` with a portal-target pattern to inject scene content from routes. https://threlte.xyz/docs/learn/basics/app-structure
- Postprocessing under SSR: "When using SvelteKit (or more broadly, SSR) be sure to add `ssr: { noExternal: ['postprocessing'] }` to your `vite.config.js`." https://threlte.xyz/docs/reference/core/use-task
- Threlte's own issue #8 (static build `ERR_MODULE_NOT_FOUND`) records the same `ssr: { noExternal: ['three'] }` workaround for three's ESM build. https://github.com/threlte/threlte/issues/8
- WebGPU path: `@threlte/core/webgpu` "swaps the default renderer for `WebGPURenderer`, awaits `renderer.init()` internally, and points `<T>` at `three/webgpu`"; it falls back to WebGL where WebGPU is unavailable and requires Vite `build.target: 'esnext'` for top-level await. https://threlte.xyz/docs/learn/advanced/webgpu

### 4. Render modes (battery)

- `'on-demand'` (default): "Threlte renders the scene only when the current frame is invalidated." `'always'`: "the most resource intensive and should only be used when necessary." `'manual'`: you trigger renders yourself; `invalidate()` from `useThrelte` requests a frame after direct three.js mutations. https://threlte.xyz/docs/learn/basics/render-modes
- three.js manual: continuous rendering of a static scene "is a waste of the devices power and if the user is on portable device it wastes the user's battery"; on-demand suits "a map viewer, a 3d editor, a 3d graph generator, a product catalog". https://threejs.org/manual/#en/rendering-on-demand

### 5. `@threlte/extras` features relevant to a graph scene

- `<InstancedMesh>` wraps `THREE.InstancedMesh`; props `id`, `limit` (default 1000, "Limits the amount of possible `<Instance>` components"), `range` (default 1000, "Limits the amount of drawn `<Instance>` components"), `update`. "Instances also support interactivity events" (`onclick`, `onpointerenter`, ...). https://threlte.xyz/docs/reference/extras/instanced-mesh
- three.js `InstancedMesh`: "Use this class if you have to render a large number of objects with the same geometry and material(s) but with different world transformations." Per-instance colour via `setColorAt` + `instanceColor.needsUpdate = true`; the bounding sphere may need recomputing after `setMatrixAt`; raycast tests the bounding sphere then each instance. https://github.com/mrdoob/three.js/blob/dev/src/objects/InstancedMesh.js
- three.js `BatchedMesh` for mixed geometries with one material ("reduce the number of draw calls"). https://github.com/mrdoob/three.js/blob/dev/src/objects/BatchedMesh.js
- `<InstancedMeshes>` turns loaded GLTF meshes into instanced meshes; creates one `InstancedMesh` per source mesh. https://threlte.xyz/docs/reference/extras/instanced-meshes
- `<InstancedSprite>` renders thousands of billboarded sprites in one mesh (marked early/unstable API). https://threlte.xyz/docs/reference/extras/instanced-sprite
- `<Text>` "uses troika-three-text to render text"; suspense-ready; `characters` prop preloads glyphs to avoid FOUC; `sdfGlyphSize` exposed. Each `<Text>` is its own mesh and draw call. https://threlte.xyz/docs/reference/extras/text
- `<HTML>` projects DOM content onto object positions; requires the Canvas container to be `position: relative|absolute|sticky|fixed`; props `transform`, `occlude` (`boolean | Object3D[] | 'blending'`), `center`, `distanceFactor`, `sprite`, `pointerEvents`, `autoRender` (set `false` to stop per-frame updates; call `render()` manually). `occlude="blending"` needs `pointer-events: none` on the canvas. https://threlte.xyz/docs/reference/extras/html
- `<Billboard>` (`follow` prop) for camera-facing labels. https://threlte.xyz/docs/reference/extras/billboard
- `interactivity()` plugin: raycast-driven `onclick`, `ondblclick`, `oncontextmenu`, `onpointerdown/up/move/over/out/enter/leave`, `onwheel`, `onpointermissed`; events bubble and objects are transparent to pointer events unless `stopPropagation()`. Touch: "the browser may cancel `pointermove` events mid-gesture ... fires a `pointercancel` event"; fix is `touch-action: none` on a wrapper, "only ... when the canvas is the primary interaction surface". Also `compute`, `filter`, `target` options. https://threlte.xyz/docs/reference/extras/interactivity
- `bvh()` plugin uses three-mesh-bvh to "speed up raycasting"; patches Mesh, BatchedMesh, Points; does not recompute when geometry changes (re-key the mesh). https://threlte.xyz/docs/reference/extras/bvh
- `<CameraControls>` is "a declarative implementation of camera-controls by yomotsu" with a `touches` prop. https://threlte.xyz/docs/reference/extras/camera-controls — camera-controls defaults: one finger `TOUCH_ROTATE`, two fingers `TOUCH_DOLLY_TRUCK` (perspective) / `TOUCH_ZOOM_TRUCK` (orthographic). https://github.com/yomotsu/camera-controls/blob/dev/readme.md
- `<OrbitControls>` wraps three's `OrbitControls`; three sets `domElement.style.touchAction = 'none'` on connect and defaults `touches: { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }`. https://threlte.xyz/docs/reference/extras/orbit-controls, https://github.com/mrdoob/three.js/blob/dev/examples/jsm/controls/OrbitControls.js
- `<TrackballControls>` (no gimbal lock, damping default on). https://threlte.xyz/docs/reference/extras/trackball-controls
- `<Edges>` extends `T.LineSegments` (1 px lines). https://threlte.xyz/docs/reference/extras/edges
- `<MeshLineGeometry>` + `<MeshLineMaterial>`: "a strip of billboarded triangles" with `width` (world units when `attenuate`, else screen px), `dashArray`, `opacity`. One mesh per line. https://threlte.xyz/docs/reference/extras/mesh-line-material
- `<PerfMonitor>` (three-perf) exposes CPU/GPU/fps/memory in-scene. https://threlte.xyz/docs/reference/extras/perf-monitor

### 6. Postprocessing

- Threlte has no postprocessing package; the documented pattern is `<Canvas autoRender={false}>` (or toggling `autoRender` in an `$effect`), build a pmndrs `EffectComposer` with `RenderPass` + `EffectPass`, and drive it with `useTask(() => composer.render(delta), { stage: renderStage, autoInvalidate: false })`. https://threlte.xyz/docs/reference/core/use-task, https://threlte.xyz/docs/examples/postprocessing/outlines/
- Custom screen-quad postprocessing via `useFBO` + `useTask` is also documented. https://threlte.xyz/docs/examples/postprocessing/screenquad

### 7. Line rendering for edges

- `LineBasicMaterial.linewidth`: "WebGL and WebGPU ignore this setting and always render line primitives with a width of one pixel." https://github.com/mrdoob/three.js/blob/dev/src/materials/LineBasicMaterial.js
- `LineSegments` is "A series of lines drawn between pairs of vertices." All edges can share one geometry and therefore one draw call. https://github.com/mrdoob/three.js/blob/dev/src/objects/LineSegments.js
- `LineSegments2` "adds functionality beyond LineSegments, like arbitrary line width and changing width to be in world units"; `LineMaterial.linewidth` is in CSS px unless `worldUnits`, and `resolution` "must be kept updated". https://github.com/mrdoob/three.js/blob/dev/examples/jsm/lines/LineSegments2.js, https://github.com/mrdoob/three.js/blob/dev/examples/jsm/lines/LineMaterial.js

### 8. Draw calls, pixel ratio, texture memory

- three.js manual: "Drawing 2 things has more overhead than drawing 1 even if the results are the same so one way to optimize is to merge meshes"; ~19000 boxes merged into one geometry reached 60 fps; merging loses per-object material/colour, solved with vertex colours. https://threejs.org/manual/#en/optimize-lots-of-objects
- HD-DPI: "Mobile GPUs have less power than desktops ... and yet mobile phones often have very high resolution displays"; at 3x DPR "Computing 9x the pixels is a lot of work"; the manual recommends sizing the drawing buffer yourself rather than `setPixelRatio` so postprocessing/picking know the true size. https://threejs.org/manual/#en/responsive
- Texture memory: a texture costs "width * height * 4 * 1.33 bytes"; a 3024x3761 JPEG of 157 KB "would take approximately 60 megabytes" on the GPU; "Small in file size = fast to download. Small in dimensions = takes less memory." https://threejs.org/manual/#en/textures
- `WebGLRenderer` defaults: `antialias: false`, `powerPreference: 'default'`, `alpha: false`, `failIfMajorPerformanceCaveat: false`; Threlte overrides to `antialias: true`, `powerPreference: 'high-performance'`, `alpha: true`. `setPixelRatio` "Sets the given pixel ratio and resizes the canvas if necessary." The renderer listens for `webglcontextlost` / `webglcontextrestored` and logs "WebGLRenderer: Context Lost." https://github.com/mrdoob/three.js/blob/dev/src/renderers/WebGLRenderer.js
- `WebGLCapabilities` falls back from `highp` to `mediump`/`lowp` with the warning "`precision` not supported, using `maxPrecision` instead", and reads `MAX_TEXTURE_SIZE` / `MAX_TEXTURE_IMAGE_UNITS` from the context. https://github.com/mrdoob/three.js/blob/dev/src/renderers/webgl/WebGLCapabilities.js

### 9. iOS Safari / WebKit WebGL

- Safari 15: "WebKit now supports WebGL2. In addition, the WebGL implementation now runs on top of Metal for better performance." https://webkit.org/blog/11989/new-webkit-features-in-safari-15/
- Safari 17.0: WebGL in `OffscreenCanvas` on iOS/iPadOS 17; GPU Process moves "2D Canvas and WebGL rendering" out of the WebContent process. https://webkit.org/blog/14445/webkit-features-in-safari-17-0/
- Safari 17.1: "Fixed an issue which would cause unnecessary 'WebGL: context lost.' errors after Safari has been moved to the background on iPadOS." https://webkit.org/blog/14735/ (tracked as https://bugs.webkit.org/show_bug.cgi?id=261331 and https://bugs.webkit.org/show_bug.cgi?id=262628)
- iOS 18.x: WebGL2 shaders using the `flat` interpolation qualifier lost the context on A12/A14-class devices; fixed in iOS 18.5 / macOS 15.5; WebKit suggests `WEBGL_provoking_vertex` instead of flat shading. https://bugs.webkit.org/show_bug.cgi?id=286297, https://bugs.webkit.org/show_bug.cgi?id=289601
- Safari 18.0 added six WebGL extensions and the `willReadFrequently` 2D-canvas attribute. https://webkit.org/blog/15865/webkit-features-in-safari-18-0/
- Safari 26.0 ships WebGPU on macOS, iOS, iPadOS and visionOS: "WebGPU supersedes WebGL on macOS, iOS, iPadOS, and visionOS and is preferred for new sites and web apps." three.js is named as supporting it. https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- iOS enforces a per-page canvas memory budget; WebKit bug 195325 reproduces "Total canvas memory use exceeds the maximum limit (384 MB)" and documents canvases not being garbage-collected promptly on iOS 12, with the memory surviving reloads. https://bugs.webkit.org/show_bug.cgi?id=195325
- Resizing an on-screen WebGL canvas on iOS Safari has leaked memory in the past. https://bugs.webkit.org/show_bug.cgi?id=219780

## Recommendation: mobile constraints checklist for the scene prototype

1. Stack: Svelte 5 + SvelteKit 2, `@threlte/core` ^8.6, `@threlte/extras` ^9.21, pin `three` to one minor in 0.175-0.186 that also satisfies `postprocessing`'s `>=0.168 <0.187` if postprocessing is ever used.
2. One `<Canvas>` mounted in `+layout.svelte`; route content portaled in. Never mount a second canvas (context cap). Keep SSR on; no `browser` guard is needed for `<Canvas>` itself, but any module that touches `window` or three addons at import time must be dynamically imported or listed in `ssr.noExternal` (`three`, `postprocessing`).
3. `<Canvas dpr={[1, 2]} renderMode="on-demand">` (or `[1, 1.5]` if GPU-bound). Never leave the raw `window.devicePixelRatio` on iPhone (3x = 9x fragment work). Call `invalidate()` after layout ticks, drags and hover changes.
4. Nodes: one `<InstancedMesh>` (`limit` >= node count, e.g. 1024) with a low-poly geometry (sphere with 8-12 segments, or a quad / `InstancedSprite`), per-instance colour via `instanceColor`. Target under 20 draw calls for the whole scene; check with `<PerfMonitor>` / `renderer.info.render.calls`.
5. Edges: one `THREE.LineSegments` with a single `BufferGeometry` (positions for all edges, vertex colours for state) and `LineBasicMaterial`; accept 1 px lines. If thicker lines are required, use one `LineSegments2` + `LineMaterial` (keep `resolution` updated on resize) rather than a `<MeshLine>` per edge (one mesh per edge = one draw call per edge).
6. Labels: do not create a `<Text>` per node. Show labels only for the hovered/selected node and its neighbours (bounded count, `characters` preloaded), or use `<HTML>` for a handful of overlays with `autoRender={false}` when static. Avoid `occlude="blending"` on mobile.
7. Interaction: `interactivity()` with events on `<Instance>`; wrap the canvas in `touch-action: none` only if the canvas is full-screen; enable `bvh()` if raycasting against non-instanced meshes is needed. Use `<CameraControls>` (touch gestures built in, `smoothTime` for damping) and disable rotation if the graph is presented 2D-style.
8. Textures: none for nodes if possible (flat colours); any sprite atlas <= 1024 px, power-of-two, budgeted with `w*h*4*1.33`. No shadow maps (`shadows={false}`), no environment maps.
9. Postprocessing (bloom/outline) off by default on mobile; if used, gate behind a device check and drop `dpr` to 1 while the composer is active.
10. Context loss: listen for `webglcontextlost` on the canvas and show a reload affordance; avoid `flat` GLSL qualifiers in custom shaders; debounce canvas resizes; dispose geometries/materials on route change.
11. Frame budget: keep the layout simulation off the render task or run it in a Worker; update `instanceMatrix` once per frame with `needsUpdate` and recompute the bounding sphere before raycasting.

## Open questions

- Which `three` minor to pin: Threlte's catalog is `^0.175.0` but three.js is at 0.186.0; needs a quick build check with the chosen `postprocessing` version.
- Exact current iOS canvas/WebGL memory ceilings per device class are not published by Apple; the 384 MB figure comes from a 2019 WebKit bug and may differ today. Measure on a real low-end iPhone.
- Whether to use `@threlte/core/webgpu` (Safari 26 ships WebGPU) or stay on WebGL for widest reach; extras compatibility with the WebGPU renderer is not documented per component.
- `LineSegments2` vs plain `LineSegments` visual quality at `dpr` 1 on a phone; the prototype should decide.
