import { describe, expect, test } from 'bun:test';
import { AnswerParser, type ParsedPart } from '../src/parse.ts';

const feed = (chunks: Array<string>): Array<ParsedPart> => {
  const p = new AnswerParser();
  const out = chunks.flatMap((c) => p.push(c));
  return [...out, ...p.finish()];
};
const text = (parts: Array<ParsedPart>) =>
  parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { delta: string }).delta)
    .join('');

describe('AnswerParser', () => {
  test('strips markers into ordered marker parts', () => {
    const parts = feed(['I used [[skill/effect]] at [[organization/acme]].']);
    expect(parts.filter((p) => p.type === 'marker').map((p) => (p as { id: string }).id)).toEqual([
      'skill/effect',
      'organization/acme',
    ]);
    expect(text(parts)).toBe('I used at.');
  });
  test('markers split across deltas still parse', () => {
    const parts = feed(['I used [', '[skill/ef', 'fect]', '] here']);
    expect(parts.filter((p) => p.type === 'marker')).toEqual([
      { type: 'marker', id: 'skill/effect' },
    ]);
    expect(text(parts)).toBe('I used here');
  });
  test('edge ids with arrows survive', () => {
    const parts = feed(['see [[project/ingestion--uses-->skill/effect]].']);
    expect(parts[1]).toEqual({ type: 'marker', id: 'project/ingestion--uses-->skill/effect' });
  });
  test('the space before a marker is kept when words follow, dropped before punctuation', () => {
    expect(
      text(feed(['built on Effect [[skill/effect]] for years, at [[organization/acme]].'])),
    ).toBe('built on Effect for years, at.');
    expect(text(feed(['Effect [[skill/effect]]', ', then']))).toBe('Effect, then');
  });
  test('followups block is captured and removed from the text, even when split', () => {
    const parts = feed(['Done.\n``', '`followups\n- one\n- two\n', '- three\n```']);
    expect(text(parts)).toBe('Done.\n');
    expect(parts.at(-1)).toEqual({ type: 'followups', prompts: ['one', 'two', 'three'] });
  });
  test('markers inside follow-ups are stripped', () => {
    const parts = feed(['Done.\n```followups\n- How was [[skill/effect]] used?\n```']);
    expect(parts.at(-1)).toEqual({ type: 'followups', prompts: ['How was used?'] });
  });
  test('an unterminated marker is released as text once it is too long', () => {
    const parts = feed(['[[' + 'x'.repeat(200)]);
    expect(text(parts)).toBe('[[' + 'x'.repeat(200));
  });
  test('ordinary backticks are not held back forever', () => {
    const parts = feed(['use `bun test` to run']);
    expect(text(parts)).toBe('use `bun test` to run');
  });
});
