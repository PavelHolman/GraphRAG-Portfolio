import { describe, expect, test } from 'bun:test';
import { Schema } from 'effect';
import { ExperienceFrontmatter, SkillFrontmatter, normalizeEdgeRef } from '../src/content.ts';

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
});
