import { describe, expect, test } from 'bun:test';
import { Schema } from 'effect';
import {
  EducationFrontmatter,
  ExperienceFrontmatter,
  PersonFrontmatter,
  SkillFrontmatter,
  normalizeEdgeRef,
} from '../src/content.ts';

describe('Frontmatter', () => {
  test('hidden defaults to false and edge refs accept both shapes', () => {
    const v = Schema.decodeUnknownSync(SkillFrontmatter)({
      type: 'skill',
      title: 'Effect',
      category: 'framework',
      'part-of': ['skill/typescript', { to: 'skill/backend', note: 'core of every service' }],
    });
    expect(v.hidden).toBe(false);
    expect(v['part-of']?.map(normalizeEdgeRef)).toEqual([
      { to: 'skill/typescript' },
      { to: 'skill/backend', note: 'core of every service' },
    ]);
  });
  test('experience requires start and parses time', () => {
    const v = Schema.decodeUnknownSync(ExperienceFrontmatter)({
      type: 'experience',
      title: 'Staff Engineer',
      start: '2021-03',
      at: ['organization/acme'],
    });
    expect(v.start instanceof Temporal.PlainYearMonth).toBe(true);
    expect(() =>
      Schema.decodeUnknownSync(ExperienceFrontmatter)({ type: 'experience', title: 'x' }),
    ).toThrow();
  });
  test('rejects an unknown category', () => {
    expect(() =>
      Schema.decodeUnknownSync(SkillFrontmatter)({ type: 'skill', title: 'x', category: 'tool' }),
    ).toThrow();
  });
  test('experience accepts part-time employment', () => {
    const v = Schema.decodeUnknownSync(ExperienceFrontmatter)({
      type: 'experience',
      title: 'Software Developer',
      start: '2020-03',
      employment: 'part-time',
    });
    expect(v.employment).toBe('part-time');
  });
  test('person carries spoken languages as label to level', () => {
    const v = Schema.decodeUnknownSync(PersonFrontmatter)({
      type: 'person',
      title: 'Pavel',
      languages: { Czech: 'native', English: 'professional working proficiency (FCE, B2)' },
    });
    expect(v.languages?.English).toContain('FCE');
  });
  test('education may deliver a project (a thesis)', () => {
    const v = Schema.decodeUnknownSync(EducationFrontmatter)({
      type: 'education',
      title: "Bachelor's",
      delivered: ['project/thesis'],
    });
    expect(v.delivered?.map(normalizeEdgeRef)).toEqual([{ to: 'project/thesis' }]);
  });
});
