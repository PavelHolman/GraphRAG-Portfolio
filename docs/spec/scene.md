# Scene spec

Decisions from the Scene prototype ([ticket](https://github.com/PavelHolman/GraphRAG/issues/15), primary source on branch [`prototype/scene`](https://github.com/PavelHolman/GraphRAG/tree/prototype/scene/prototypes/scene), winning variant `?variant=A` "Ember"). Vocabulary per `CONTEXT.md`; renderer constraints per the Threlte research. Implementation lives in `apps/web/src/lib/scene` (ADR 0002).

## Layout

- **Precomputed force layout with cluster gravity**, computed at index time by `graph-index` and shipped in the artifact. Per-type cluster centres on a ring, Person at the origin, repulsion + springs + gravity, ~350 iterations. Deterministic seed.
- **Answer-time shift** (client-side, per Turn): with centroid `c` of the Used Subgraph, seeds move to `c + (p − c) × 0.66`, cited neighbours `× 0.78`, everything else `× 1.16`; then translate all by `−c` so the Subgraph sits at the origin. Camera target stays at origin. Strength 0.45 is the approved value.

## Highlight language

| State | Colour | Size | Glow |
|---|---|---|---|
| Rest | `#d6d2c9`; Person `#f1efe9` | 0.8 + degree-scaled; Person 2.4 | 0.35; Person 0.9 |
| Seed (cited, in Prompt) | `#ff8a72` (the only accent) | 3.0 | 1.8 |
| Cited neighbour | `#f1efe9` | 1.7 | 0.7 |
| Not cited | `#4a4743` | 0.55 | 0 |

Edges: rest `#242220`, cited `#8a5f54`, not cited `#1a1816`, additive hairlines. Labels: seeds only, billboarded, capped at 12, off-white with a dark outline, positioned per frame.

## Delta animation

All of position, size, colour, glow lerp per frame with `k = 1 − 0.002^dt` (about 0.6 s to settle). In and out are simultaneous. Rendering is on-demand; the task calls `invalidate()` only while something moves.

## Renderer

- One `THREE.Points` for all Nodes with a `ShaderMaterial`: attributes `aColor`, `aSize`, `aGlow`; fragment = smoothstep core + gaussian halo (`exp(−d²·2.6)`); `gl_PointSize = aSize · dpr · 520 / −z`; additive blending, fog-aware. Picking via `Points.raycast` with threshold 0.6.
- One `THREE.LineSegments` for all Edges with vertex colours, additive, 1 px.
- One static dust `Points` field (700 points, `#6b6761`, opacity 0.55) for depth.
- `FogExp2('#161514', 0.016)`. No lights, no spheres, no shadows, no postprocessing.
- `<Canvas dpr={[1, 2]} renderMode="on-demand" shadows={false}>`; one canvas per app; `webglcontextlost` handler shows a reload affordance.
- Camera: `PerspectiveCamera` fov 50 at `[0, 6, 30]`, `CameraControls` with `smoothTime 0.3`, distance 6 to 70; portrait viewports multiply the initial position by 1.9. Slow azimuth drift (0.05 rad/s) until the first `controlstart`.

## Design language

Tokens from the Poqet site: `--bg #161514`, `--bg-soft #1d1b19`, `--surface #0b0a09`, `--fg #f1efe9`, `--fg-muted #9d9a92`, `--line rgba(241,239,233,.12)`, `--accent #ff8a72`, `--accent-soft rgba(255,138,114,.14)`, `--panel #0f0e0d`. Fonts: DM Sans (body, buttons), Azeret Mono uppercase with `.12em` tracking (microcopy, stats), Bricolage Grotesque (display, picked-Node title). Pill buttons with hairline borders; active state uses `--accent-soft` fill and `--accent` border and text. Coral appears nowhere except the cited Subgraph and active controls.

## Mobile

Verified on a real phone at 60 fps with 164 Nodes and 375 Edges: touch orbit and pinch via CameraControls, `touch-action: none` on the full-screen stage, safe-area insets on the HUD. No reduced node count or LOD needed at this size.

## Rejected

Concentric shells and 2.5D stacked layers (layout); static layout and strong pull (shift); flat shaded instanced spheres, both with type colours and with the palette (look); "Rings" and "Nebula" flavours of the constellation.
