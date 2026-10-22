# Chat panel spec

Decisions from the chat-panel prototype ([ticket](https://github.com/PavelHolman/GraphRAG/issues/16), primary source on branch [`prototype/scene`](https://github.com/PavelHolman/GraphRAG/tree/prototype/scene/prototypes/scene), winning variant `?variant=B`). Wire format per ADR 0003; Scene per `docs/spec/scene.md`; vocabulary per `CONTEXT.md`. Implementation lives in `apps/web` (ADR 0002), built with shadcn primitives styled to the Poqet tokens.

## Layout

- Everything is **horizontally centred**, max width 680px, 12px side gutters. Same layout on desktop and phone.
- **Prompt field** at the bottom: pill, `--panel` background at 88% with blur, hairline border, a quiet × on the left that closes it (same footprint as the send button), a round coral send button on the right that breathes while an Answer streams.
- **Answer caption** directly above the field: `--panel` at 82% with blur, hairline border, 14px radius. Content: a mono uppercase question line (prefixed ✦ when the Prompt came from a hint), the Answer text, the Citation chip row, then Followup chips. Capped at about 9 lines with a bottom fade and a `+` toggle that expands to 50vh scrolling.
- The Scene keeps the upper half of the viewport; the Used Subgraph recentres at the Scene origin, which sits above the caption.

## Hints and the field

- The field is **hidden until asked for**: absent on load, "Ask about me" morphs into it in place in one view transition (the two pills share a name): the field takes the whole actions row's spot, Contact and Download CV fade out with the page (the header keeps both), and the field takes focus. The ghost hint fades only when it cycles, never on that entrance. A question asked from anywhere else (Sections, the pick card, a text selection) opens it without focus. The × at the pill's left end, or Escape, closes it and any answer, morphing back into the button, which gets focus. Hint previews on the Scene wait for it to open. Without view-transition support or with reduced motion the swap is instant.
- The field shows a **ghost hint** (a suggested Prompt) as placeholder text, cycling every 6 s with a short fade, paused while streaming or while the field has text (focus alone does not pause it). Hints are authored, not generated.
- **No auto-play.** Submitting an empty field (Enter or the button) sends the hint currently shown as a suggested Prompt. The button shows ▶ when the field is empty and ↵ when it has text.
- Typing hides the ghost text.
- **Hint preview in the Scene**: while a ghost hint is showing and no Turn is streaming, the Scene faintly lights that hint's related Nodes (the faint tier, no seeds, no Answer). Each hint carries its precomputed candidate Node ids in the static artifact, so the preview needs no request. When the hint cycles, the preview cross-fades to the next set; typing or a real Prompt clears it.

## Citations

- In the Answer text: coral, underlined, with a superscript ordinal, rendered at the point the `citation` event arrived (ADR 0003 ordinal semantics).
- Under the text: a **numbered chip row** mirroring the same Citations.
- Clicking either **focuses** the Node: CameraControls `moveTo(node, smooth)` then `dollyTo(min(distance, 14), smooth)`; the idle drift stops; the chip and underline show a focused state.

## Stream handling (client)

| Event           | Client behaviour                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `turn-started`  | push the visitor message and an empty streaming Answer; clear Followups and focus                                                          |
| `subgraph`      | set the Scene Subgraph to the candidate with **no seeds**, so candidates render in the faint tier                                          |
| `text`          | append to the Answer's last text part                                                                                                      |
| `citation`      | append a Citation part; add the Node to the Subgraph seeds (progressive Highlight)                                                         |
| `followups`     | show Followup chips                                                                                                                        |
| `turn-finished` | seeds = used Nodes; nodes = used ∪ their candidate neighbours ∪ Person; edges = candidate edges touching a used Node; mark the Answer done |
| `error`         | show inline in the caption; keep the previous Highlight; no retry                                                                          |

- **New Prompt mid-stream**: abort the fetch, mark the previous Answer done, keep the previous Highlight until the next `subgraph` event.
- Followup click sends a real Prompt.

## Rejected

Side panel with mobile bottom sheet (covers too much Scene, collapse unnatural); floating side card (not centred); top strip and middle column placements; hover-to-preview on hint chips; auto-playing hints; dropping cited neighbours at the end of a Turn.
