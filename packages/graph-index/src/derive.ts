import type { NodeId, PlainTime } from '@graphrag/schema';
import { compareStart, endOf } from '@graphrag/schema';
import type { LoadedNode } from './load.ts';
import type { ResolvedEdge } from './validate.ts';

export interface Span {
  readonly start: PlainTime;
  readonly end?: PlainTime;
}

/** Skill spans from the Experiences and Projects that `use` them. ADR 0001. Never authored. */
export const deriveSpans = (
  nodes: ReadonlyArray<LoadedNode>,
  edges: ReadonlyArray<ResolvedEdge>,
): Map<NodeId, Span> => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const spans = new Map<NodeId, { start: PlainTime; end: PlainTime | undefined; open: boolean }>();
  for (const e of edges) {
    if (e.type !== 'uses') continue;
    const src = byId.get(e.source);
    if (!src) continue;
    const fm = src.frontmatter as { start?: PlainTime; end?: PlainTime };
    if (!fm.start) continue;
    const cur = spans.get(e.target);
    const open = fm.end === undefined;
    if (!cur) {
      spans.set(e.target, { start: fm.start, end: fm.end, open });
      continue;
    }
    if (compareStart(fm.start, cur.start) < 0) cur.start = fm.start;
    if (open) cur.open = true;
    else if (
      !cur.open &&
      cur.end !== undefined &&
      Temporal.PlainDate.compare(endOf(fm.end as PlainTime), endOf(cur.end)) > 0
    ) {
      cur.end = fm.end;
    }
  }
  const out = new Map<NodeId, Span>();
  for (const [id, s] of spans)
    out.set(
      id,
      s.open || s.end === undefined ? { start: s.start } : { start: s.start, end: s.end },
    );
  return out;
};
