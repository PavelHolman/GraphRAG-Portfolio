import { describe, expect, test } from 'bun:test';
import { attachCitation, findMention } from '../src/lib/chat/mention.ts';
import type { CitePart, Message } from '../src/lib/chat/types.ts';

const answer = (text: string): Message => ({
  role: 'answer',
  parts: [{ kind: 'text', text }],
  streaming: true,
});
const cite = (id: string): CitePart => ({ kind: 'cite', id, ordinal: 0, title: id, label: '' });
const labels = (m: Message) => m.parts.map((p) => (p.kind === 'text' ? p.text : `[${p.label}]`));

describe('findMention', () => {
  test('ignores an occurrence glued to a longer word', () => {
    expect(findMention('co-founded deelscorp in 2024', 'deels')).toBe(-1);
    expect(findMention('built with swiftui', 'swift')).toBe(-1);
  });
  test('takes the last standalone occurrence', () => {
    expect(findMention('deels, then deels again', 'deels')).toBe(12);
  });
  test('punctuation and symbols are not word characters', () => {
    expect(findMention('wrote c# there', 'c#')).toBe(6);
    expect(findMention('(effect)', 'effect')).toBe(1);
  });
});

describe('attachCitation', () => {
  test('underlines the mention in place', () => {
    const a = answer('He led Deels end to end');
    attachCitation(a, cite('project/deels'), ['Deels']);
    expect(labels(a)).toEqual(['He led ', '[Deels]', ' end to end']);
  });
  test('stays bare rather than splitting a longer word', () => {
    const a = answer('He co-founded DeelsCorp');
    attachCitation(a, cite('project/deels'), ['Deels']);
    expect(labels(a)).toEqual(['He co-founded DeelsCorp', '[]']);
  });
  test('ignores a mention further back than the window', () => {
    const a = answer(`Deels${'.'.repeat(300)}`);
    attachCitation(a, cite('project/deels'), ['Deels']);
    expect(labels(a).at(-1)).toBe('[]');
  });
  test('prefers the latest of several candidate names', () => {
    const a = answer('poqet builds SLIM');
    attachCitation(a, cite('experience/poqet--led-->project/slim'), ['poqet', 'SLIM']);
    expect(labels(a)).toEqual(['poqet builds ', '[SLIM]']);
  });
});
