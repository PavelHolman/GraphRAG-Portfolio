import { Effect, Schema } from 'effect';
import { NodeId } from './ids.ts';
import { PlainTime } from './time.ts';

/** `{ to, note? }` or the bare `to` string. ADR 0001. */
export const EdgeRef = Schema.Union([
  NodeId,
  Schema.Struct({ to: NodeId, note: Schema.optionalKey(Schema.String) }),
]);
export type EdgeRef = typeof EdgeRef.Type;

export const normalizeEdgeRef = (ref: EdgeRef): { to: NodeId; note?: string } =>
  typeof ref === 'string' ? { to: ref } : ref;

const EdgeList = Schema.optionalKey(Schema.Array(EdgeRef));

const Common = {
  title: Schema.NonEmptyString,
  summary: Schema.optionalKey(Schema.String),
  hidden: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
};

export const SkillCategory = Schema.Literals([
  'language',
  'framework',
  'platform',
  'practice',
  'leadership',
]);
export type SkillCategory = typeof SkillCategory.Type;

export const Employment = Schema.Literals(['full-time', 'contract', 'freelance', 'founder']);
export const OrganizationKind = Schema.Literals(['company', 'university', 'client', 'community']);

export const PersonFrontmatter = Schema.Struct({
  ...Common,
  type: Schema.Literal('person'),
  /** One line under the name in the Hero, e.g. a job title. */
  headline: Schema.optionalKey(Schema.String),
  lede: Schema.optionalKey(Schema.String),
  location: Schema.optionalKey(Schema.String),
  links: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
});

export const SkillFrontmatter = Schema.Struct({
  ...Common,
  type: Schema.Literal('skill'),
  category: SkillCategory,
  aliases: Schema.optionalKey(Schema.Array(Schema.String)),
  'part-of': EdgeList,
  'related-to': EdgeList,
});

export const ProjectFrontmatter = Schema.Struct({
  ...Common,
  type: Schema.Literal('project'),
  start: Schema.optionalKey(PlainTime),
  end: Schema.optionalKey(PlainTime),
  url: Schema.optionalKey(Schema.String),
  repo: Schema.optionalKey(Schema.String),
  uses: EdgeList,
  'in-domain': EdgeList,
});

export const ExperienceFrontmatter = Schema.Struct({
  ...Common,
  type: Schema.Literal('experience'),
  start: PlainTime,
  end: Schema.optionalKey(PlainTime),
  role: Schema.optionalKey(Schema.String),
  employment: Schema.optionalKey(Employment),
  uses: EdgeList,
  at: EdgeList,
  delivered: EdgeList,
  led: EdgeList,
  'in-domain': EdgeList,
});

export const EducationFrontmatter = Schema.Struct({
  ...Common,
  type: Schema.Literal('education'),
  start: Schema.optionalKey(PlainTime),
  end: Schema.optionalKey(PlainTime),
  degree: Schema.optionalKey(Schema.String),
  field: Schema.optionalKey(Schema.String),
  at: EdgeList,
  taught: EdgeList,
});

export const OrganizationFrontmatter = Schema.Struct({
  ...Common,
  type: Schema.Literal('organization'),
  url: Schema.optionalKey(Schema.String),
  location: Schema.optionalKey(Schema.String),
  kind: Schema.optionalKey(OrganizationKind),
  'in-domain': EdgeList,
});

export const DomainFrontmatter = Schema.Struct({
  ...Common,
  type: Schema.Literal('domain'),
  aliases: Schema.optionalKey(Schema.Array(Schema.String)),
});

/** The frontmatter of one authored Node; `type` is injected by the loader from the directory name. */
export const Frontmatter = Schema.Union([
  PersonFrontmatter,
  SkillFrontmatter,
  ProjectFrontmatter,
  ExperienceFrontmatter,
  EducationFrontmatter,
  OrganizationFrontmatter,
  DomainFrontmatter,
]);
export type Frontmatter = typeof Frontmatter.Type;

export const FRONTMATTER_BY_TYPE = {
  person: PersonFrontmatter,
  skill: SkillFrontmatter,
  project: ProjectFrontmatter,
  experience: ExperienceFrontmatter,
  education: EducationFrontmatter,
  organization: OrganizationFrontmatter,
  domain: DomainFrontmatter,
} as const;

/** Authored hints: suggested Prompts shown as ghost text. `content/hints.yaml`. */
export const HintsFile = Schema.Struct({
  hints: Schema.Array(Schema.Struct({ id: Schema.NonEmptyString, prompt: Schema.NonEmptyString })),
});
export type HintsFile = typeof HintsFile.Type;
