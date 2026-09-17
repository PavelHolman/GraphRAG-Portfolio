import type { ArtifactEdge, ArtifactNode } from '@graphrag/schema';
import { compareStart, startOf } from '@graphrag/schema';

/** Section view models built server-side from the artifact. `docs/spec/page.md`. */
export interface ExperienceItem {
  readonly id: string;
  readonly startYear: number | undefined;
  readonly title: string;
  readonly role: string | undefined;
  readonly organization: string | undefined;
  readonly organizationUrl: string | undefined;
  readonly range: string;
  readonly body: string;
  readonly skills: ReadonlyArray<{ title: string; note: string | undefined }>;
  readonly projects: ReadonlyArray<{
    id: string;
    title: string;
    summary: string | undefined;
    url: string | undefined;
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
  /** A thesis or course project the studies `delivered`. */
  readonly projects: ReadonlyArray<{
    id: string;
    title: string;
    summary: string | undefined;
    url: string | undefined;
  }>;
}
/** A Project no Experience or Education owns: it gets its own card. */
export interface ProjectItem {
  readonly id: string;
  readonly title: string;
  readonly summary: string | undefined;
  readonly range: string;
  readonly body: string;
  readonly url: string | undefined;
  readonly repo: string | undefined;
  readonly skills: ReadonlyArray<string>;
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
    headline: string | undefined;
    lede: string | undefined;
    body: string;
    location: string | undefined;
    availability: string | undefined;
    /** Derived from the earliest Experience start, e.g. "6 years, since 2020". */
    experience: string | undefined;
    links: Record<string, string>;
    languages: Record<string, string>;
  };
  readonly experience: ReadonlyArray<ExperienceItem>;
  readonly education: ReadonlyArray<EducationItem>;
  readonly projects: ReadonlyArray<ProjectItem>;
  readonly skills: ReadonlyArray<SkillGroup>;
}

const fmt = (t: ArtifactNode['start']): string => (t ? t.toString() : '');
const range = (n: ArtifactNode): string => {
  if (!n.start) return '';
  return `${fmt(n.start)} – ${n.end ? fmt(n.end) : 'present'}`;
};
// Most recent first; Nodes without a start (undated coursework) sink to the end.
const byStartDesc = (a: ArtifactNode, b: ArtifactNode): number => {
  if (a.start && b.start) return -compareStart(a.start, b.start);
  return (a.start ? 0 : 1) - (b.start ? 0 : 1);
};
const field = (n: ArtifactNode, k: string): string | undefined => {
  const v = n.fields[k];
  return typeof v === 'string' ? v : undefined;
};
/** "6 years, since 2020": whole years from the earliest start to today. Never authored. ADR 0001. */
const yearsOfExperience = (years: ReadonlyArray<number | undefined>): string | undefined => {
  const starts = years.filter((y): y is number => y !== undefined);
  if (!starts.length) return undefined;
  const since = Math.min(...starts);
  const n = Temporal.Now.plainDateISO().year - since;
  return `${n} year${n === 1 ? '' : 's'}, since ${since}`;
};
const urlOf = (n: ArtifactNode | undefined): string | undefined =>
  n ? field(n, 'url') : undefined;

export const buildPageModel = (
  nodes: ReadonlyArray<ArtifactNode>,
  edges: ReadonlyArray<ArtifactEdge>,
): PageModel => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visible = nodes.filter((n) => !n.hidden);
  const out = (id: string, type: ArtifactEdge['type']) =>
    edges.filter((e) => e.source === id && e.type === type);
  const person = visible.find((n) => n.type === 'person');
  // A Project renders under exactly one owner: the first Experience or Education (in section
  // order) that `led` or `delivered` it. The schema allows several owners; the page never shows twice.
  const placed = new Set<string>();
  const claim = (id: string): boolean => !placed.has(id) && Boolean(placed.add(id));

  const experience = visible
    .filter((n) => n.type === 'experience')
    .sort(byStartDesc)
    .map((n): ExperienceItem => ({
      id: n.id,
      startYear: n.start ? startOf(n.start).year : undefined,
      title: n.title,
      role: field(n, 'role'),
      organization: byId.get(out(n.id, 'at')[0]?.target ?? '')?.title,
      organizationUrl: urlOf(byId.get(out(n.id, 'at')[0]?.target ?? '')),
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
        .filter(({ e }) => byId.get(e.target) !== undefined && claim(e.target))
        .map(({ e, led }) => ({
          id: e.target,
          title: byId.get(e.target)!.title,
          summary: byId.get(e.target)!.summary,
          url: urlOf(byId.get(e.target)),
          led,
        })),
    }));

  const education = visible
    .filter((n) => n.type === 'education')
    .sort(byStartDesc)
    .map((n): EducationItem => ({
      id: n.id,
      title: n.title,
      degree: field(n, 'degree'),
      field: field(n, 'field'),
      organization: byId.get(out(n.id, 'at')[0]?.target ?? '')?.title,
      range: range(n),
      body: n.body,
      projects: out(n.id, 'delivered')
        .map((e) => byId.get(e.target))
        .filter((p): p is ArtifactNode => p !== undefined && !p.hidden && claim(p.id))
        .map((p) => ({ id: p.id, title: p.title, summary: p.summary, url: urlOf(p) })),
    }));

  // Projects nobody `delivered` or `led` stand on their own (this site, contest results).
  const projects = visible
    .filter((n) => n.type === 'project' && !placed.has(n.id))
    .sort(byStartDesc)
    .map((n): ProjectItem => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      range: range(n),
      body: n.body,
      url: field(n, 'url'),
      repo: field(n, 'repo'),
      skills: out(n.id, 'uses').map((e) => byId.get(e.target)?.title ?? e.target),
    }));

  const groups = new Map<string, Array<ArtifactNode>>();
  for (const n of visible.filter((n) => n.type === 'skill')) {
    const c = field(n, 'category') ?? 'other';
    groups.set(c, [...(groups.get(c) ?? []), n]);
  }
  // Most recent span first; Skills without a span go last.
  const EPOCH = Temporal.PlainDate.from('1970-01-01');
  const spanKey = (n: ArtifactNode): number =>
    n.span ? -EPOCH.until(startOf(n.span.start)).total({ unit: 'days' }) : Number.POSITIVE_INFINITY;
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
      headline: person ? field(person, 'headline') : undefined,
      lede: person ? field(person, 'lede') : undefined,
      body: person?.body ?? '',
      location: person ? field(person, 'location') : undefined,
      availability: person ? field(person, 'availability') : undefined,
      experience: yearsOfExperience(experience.map((x) => x.startYear)),
      links: person?.links ?? {},
      languages: person?.languages ?? {},
    },
    experience,
    education,
    projects,
    skills,
  };
};
