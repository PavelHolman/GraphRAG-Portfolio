import type { EdgeType, NodeId } from '@graphrag/schema';
import {
  EDGE_RULES,
  EDGE_TYPES,
  edgeId,
  normalizeEdgeRef,
  nodeTypeOf,
  type EdgeId,
} from '@graphrag/schema';
import type { ContentIssue, LoadedNode } from './load.ts';

export interface ResolvedEdge {
  readonly id: EdgeId;
  readonly source: NodeId;
  readonly target: NodeId;
  readonly type: EdgeType;
  readonly note?: string;
}

export interface Validated {
  readonly edges: ReadonlyArray<ResolvedEdge>;
  readonly issues: ReadonlyArray<ContentIssue>;
}

const edgeLists = (
  n: LoadedNode,
): Array<[EdgeType, ReadonlyArray<{ to: NodeId; note?: string }>]> => {
  const out: Array<[EdgeType, ReadonlyArray<{ to: NodeId; note?: string }>]> = [];
  const fm = n.frontmatter as Record<string, unknown>;
  for (const t of EDGE_TYPES) {
    const v = fm[t];
    if (Array.isArray(v))
      out.push([t, (v as Array<Parameters<typeof normalizeEdgeRef>[0]>).map(normalizeEdgeRef)]);
  }
  return out;
};

/** Cross-file rules: dangling refs, Edge types per source type, orphans, aliases, exactly one Person. */
export const validate = (nodes: ReadonlyArray<LoadedNode>): Validated => {
  const issues: Array<ContentIssue> = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: Array<ResolvedEdge> = [];
  const seenEdge = new Set<string>();
  const degree = new Map<NodeId, number>();

  const persons = nodes.filter((n) => n.type === 'person');
  if (persons.length !== 1) {
    issues.push({
      file: persons[1]?.file ?? 'content/person',
      message: `exactly one Person Node is required, found ${persons.length}`,
    });
  }

  for (const n of nodes) {
    for (const [type, refs] of edgeLists(n)) {
      const rule = EDGE_RULES[type];
      if (!rule.from.includes(n.type)) {
        issues.push({
          file: n.file,
          message: `${type}: not allowed on a ${n.type} Node (allowed from ${rule.from.join(', ')})`,
        });
        continue;
      }
      for (const ref of refs) {
        if (!byId.has(ref.to)) {
          issues.push({
            file: n.file,
            message: `${type}: dangling reference ${JSON.stringify(ref.to)} (no content/${ref.to}.md)`,
          });
          continue;
        }
        if (nodeTypeOf(ref.to) !== rule.to) {
          issues.push({
            file: n.file,
            message: `${type}: ${ref.to} is a ${nodeTypeOf(ref.to)}, expected a ${rule.to}`,
          });
          continue;
        }
        if (ref.to === n.id) {
          issues.push({ file: n.file, message: `${type}: a Node cannot point at itself` });
          continue;
        }
        const id = edgeId(n.id, type, ref.to);
        if (seenEdge.has(id)) {
          issues.push({ file: n.file, message: `${type}: duplicate reference to ${ref.to}` });
          continue;
        }
        seenEdge.add(id);
        edges.push({
          id,
          source: n.id,
          target: ref.to,
          type,
          ...(ref.note !== undefined ? { note: ref.note } : {}),
        });
        degree.set(n.id, (degree.get(n.id) ?? 0) + 1);
        degree.set(ref.to, (degree.get(ref.to) ?? 0) + 1);
      }
    }
  }

  // CV curation on the Person names Nodes by id; they must exist, and grouped ones must be Skills.
  for (const p of persons) {
    const cv = 'cv' in p.frontmatter ? p.frontmatter.cv : undefined;
    const grouped = Object.values(cv?.skills ?? {}).flat();
    for (const id of [...grouped, ...(cv?.omit ?? [])]) {
      if (!byId.has(id)) {
        issues.push({ file: p.file, message: `cv: dangling reference ${JSON.stringify(id)}` });
      }
    }
    for (const id of grouped) {
      if (byId.has(id) && nodeTypeOf(id) !== 'skill') {
        issues.push({ file: p.file, message: `cv.skills: ${id} is not a skill` });
      }
    }
  }

  for (const n of nodes) {
    if (n.type !== 'person' && (degree.get(n.id) ?? 0) === 0) {
      issues.push({ file: n.file, message: 'orphan Node: no Edge points to or from it' });
    }
  }

  const names = new Map<string, NodeId>();
  for (const n of nodes) names.set(n.frontmatter.title.toLowerCase(), n.id);
  for (const n of nodes) {
    const aliases = 'aliases' in n.frontmatter ? (n.frontmatter.aliases ?? []) : [];
    for (const a of aliases) {
      const key = a.toLowerCase();
      const other = names.get(key);
      if (other !== undefined && other !== n.id) {
        issues.push({ file: n.file, message: `alias ${JSON.stringify(a)} collides with ${other}` });
      } else names.set(key, n.id);
    }
  }

  return { edges, issues };
};
