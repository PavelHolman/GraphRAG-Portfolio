import type { ArtifactEdge, ArtifactNode } from '@graphrag/schema';
import { compareStart } from '@graphrag/schema';

/** Section view models built server-side from the artifact. `docs/spec/page.md`. */
export interface ExperienceItem {
  readonly id: string;
  readonly title: string;
  readonly role: string | undefined;
  readonly organization: string | undefined;
  readonly range: string;
  readonly body: string;
  readonly skills: ReadonlyArray<{ title: string; note: string | undefined }>;
  readonly projects: ReadonlyArray<{
    id: string;
    title: string;
    summary: string | undefined;
    led: boolean;
  }>;
}
export interface EducationItem {
  readonly id: string;
  readonly title: string;
  readonly degree: string | undefined;
  readonly field: string | undefined;
  readonly organization: string | undefined;
  readonly range: string;
  readonly body: string;
}
export interface SkillGroup {
  readonly category: string;
  readonly skills: ReadonlyArray<{
    id: string;
    title: string;
    summary: string | undefined;
    span: string;
  }>;
}
export interface PageModel {
  readonly person: {
    name: string;
    lede: string | undefined;
    body: string;
    location: string | undefined;
    links: Record<string, string>;
  };
  readonly experience: ReadonlyArray<ExperienceItem>;
  readonly education: ReadonlyArray<EducationItem>;
  readonly skills: ReadonlyArray<SkillGroup>;
}

const fmt = (t: ArtifactNode['start']): string => (t ? t.toString() : '');
const range = (n: ArtifactNode): string => {
  if (!n.start) return '';
  return `${fmt(n.start)} – ${n.end ? fmt(n.end) : 'present'}`;
};
const field = (n: ArtifactNode, k: string): string | undefined => {
  const v = n.fields[k];
  return typeof v === 'string' ? v : undefined;
};

export const buildPageModel = (
  nodes: ReadonlyArray<ArtifactNode>,
  edges: ReadonlyArray<ArtifactEdge>,
): PageModel => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visible = nodes.filter((n) => !n.hidden);
  const out = (id: string, type: ArtifactEdge['type']) =>
    edges.filter((e) => e.source === id && e.type === type);
  const person = visible.find((n) => n.type === 'person');

  const experience = visible
    .filter((n) => n.type === 'experience')
    .sort((a, b) => (a.start && b.start ? -compareStart(a.start, b.start) : 0))
    .map((n): ExperienceItem => ({
      id: n.id,
      title: n.title,
      role: field(n, 'role'),
      organization: byId.get(out(n.id, 'at')[0]?.target ?? '')?.title,
      range: range(n),
      body: n.body,
      skills: out(n.id, 'uses')
        .sort((a, b) => (b.note ? 1 : 0) - (a.note ? 1 : 0))
        .slice(0, 6)
        .map((e) => ({ title: byId.get(e.target)?.title ?? e.target, note: e.note })),
      projects: [
        ...out(n.id, 'led').map((e) => ({ e, led: true })),
        ...out(n.id, 'delivered').map((e) => ({ e, led: false })),
      ]
        .map(
          ({ e, led }) =>
            byId.get(e.target) && {
              id: e.target,
              title: byId.get(e.target)!.title,
              summary: byId.get(e.target)!.summary,
              led,
            },
        )
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    }));

  const education = visible
    .filter((n) => n.type === 'education')
    .sort((a, b) => (a.start && b.start ? -compareStart(a.start, b.start) : 0))
    .map((n): EducationItem => ({
      id: n.id,
      title: n.title,
      degree: field(n, 'degree'),
      field: field(n, 'field'),
      organization: byId.get(out(n.id, 'at')[0]?.target ?? '')?.title,
      range: range(n),
      body: n.body,
    }));

  const groups = new Map<string, Array<ArtifactNode>>();
  for (const n of visible.filter((n) => n.type === 'skill')) {
    const c = field(n, 'category') ?? 'other';
    groups.set(c, [...(groups.get(c) ?? []), n]);
  }
  const spanKey = (n: ArtifactNode) =>
    n.span
      ? -Temporal.PlainDate.compare(
          n.span.start.toString().length === 7
            ? Temporal.PlainYearMonth.from(n.span.start.toString()).toPlainDate({ day: 1 })
            : Temporal.PlainDate.from(n.span.start.toString()),
          Temporal.PlainDate.from('2100-01-01'),
        )
      : Number.POSITIVE_INFINITY;
  const skills = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, list]): SkillGroup => ({
      category,
      skills: list
        .sort((a, b) => spanKey(a) - spanKey(b) || a.title.localeCompare(b.title))
        .map((n) => ({
          id: n.id,
          title: n.title,
          summary: n.summary,
          span: n.span ? `${fmt(n.span.start)} – ${n.span.end ? fmt(n.span.end) : 'present'}` : '',
        })),
    }));

  return {
    person: {
      name: person?.title ?? '',
      lede: person ? field(person, 'lede') : undefined,
      body: person?.body ?? '',
      location: person ? field(person, 'location') : undefined,
      links: person?.links ?? {},
    },
    experience,
    education,
    skills,
  };
};
