// Where a streamed Citation attaches in the Answer text. Pure: no runes, no DOM, unit-tested.
import type { CitePart, Message } from './types.ts';

/** How far back in the streamed text a Citation may reach to underline its mention. */
export const MENTION_WINDOW = 240;

/** Letters and digits: a mention may neither start nor end inside one. */
const isWordChar = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c);

/**
 * Index of the last standalone occurrence of `needle` in `hay`, or -1. Standalone means not glued
 * to a longer word, so "Deels" never underlines the first half of "DeelsCorp" and "Swift" never
 * underlines that of "SwiftUI".
 */
export const findMention = (hay: string, needle: string): number => {
  for (
    let at = hay.lastIndexOf(needle);
    at !== -1;
    at = at === 0 ? -1 : hay.lastIndexOf(needle, at - 1)
  ) {
    if (!isWordChar(hay[at - 1]) && !isWordChar(hay[at + needle.length])) return at;
  }
  return -1;
};

/**
 * Places a Citation on the nearest preceding mention of one of `names` in the Answer text, so the
 * existing words get underlined instead of a second name being appended. Without a mention the
 * Citation is appended bare (superscript only).
 */
export const attachCitation = (a: Message, cite: CitePart, names: ReadonlyArray<string>): void => {
  const last = a.parts.at(-1);
  if (last?.kind === 'text') {
    const hay = last.text.toLowerCase();
    let best: { at: number; len: number } | undefined;
    for (const name of names) {
      const needle = name.trim().toLowerCase();
      if (needle.length < 2) continue;
      const at = findMention(hay, needle);
      if (at === -1 || hay.length - at > MENTION_WINDOW) continue;
      if (!best || at > best.at) best = { at, len: needle.length };
    }
    if (best) {
      const before = last.text.slice(0, best.at);
      const label = last.text.slice(best.at, best.at + best.len);
      const after = last.text.slice(best.at + best.len);
      a.parts.pop();
      if (before) a.parts.push({ kind: 'text', text: before });
      a.parts.push({ ...cite, label });
      if (after) a.parts.push({ kind: 'text', text: after });
      return;
    }
  }
  a.parts.push(cite);
};
