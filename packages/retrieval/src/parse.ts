/**
 * Streaming parser for the Answer text: strips `[[id]]` markers into citation parts in stream order and
 * captures the trailing fenced `followups` block. ADR 0003, ADR 0004 stage 7.
 */
export type ParsedPart =
  | { readonly type: 'text'; readonly delta: string }
  | { readonly type: 'marker'; readonly id: string }
  | { readonly type: 'followups'; readonly prompts: ReadonlyArray<string> };

const FENCE = '```followups';
const MARKER_OPEN = '[[';
const MARKER_CLOSE = ']]';
const MAX_MARKER = 160;

const longestSuffixThatPrefixes = (buf: string, token: string): number => {
  const max = Math.min(buf.length, token.length - 1);
  for (let len = max; len > 0; len--) {
    if (token.startsWith(buf.slice(buf.length - len))) return len;
  }
  return 0;
};

export const parseFollowups = (block: string): Array<string> =>
  block
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length > 0 && l !== '```')
    .slice(0, 3);

export class AnswerParser {
  private buf = '';
  private inFollowups = false;
  private followupsBuf = '';

  push(delta: string): Array<ParsedPart> {
    if (this.inFollowups) {
      this.followupsBuf += delta;
      return [];
    }
    this.buf += delta;
    const out: Array<ParsedPart> = [];
    for (;;) {
      const fence = this.buf.indexOf(FENCE);
      const open = this.buf.indexOf(MARKER_OPEN);
      if (fence !== -1 && (open === -1 || fence < open)) {
        const before = this.buf.slice(0, fence);
        if (before) out.push({ type: 'text', delta: before });
        this.inFollowups = true;
        this.followupsBuf = this.buf.slice(fence + FENCE.length);
        this.buf = '';
        return out;
      }
      if (open === -1) break;
      const close = this.buf.indexOf(MARKER_CLOSE, open + MARKER_OPEN.length);
      if (close === -1) {
        if (this.buf.length - open > MAX_MARKER) {
          // Not a marker after all; release the literal text.
          const upTo = open + MARKER_OPEN.length;
          out.push({ type: 'text', delta: this.buf.slice(0, upTo) });
          this.buf = this.buf.slice(upTo);
          continue;
        }
        break;
      }
      const before = this.buf.slice(0, open);
      if (before) out.push({ type: 'text', delta: before });
      out.push({ type: 'marker', id: this.buf.slice(open + MARKER_OPEN.length, close).trim() });
      this.buf = this.buf.slice(close + MARKER_CLOSE.length);
    }
    // Hold back only what could still become a marker or a fence.
    const hold = Math.max(
      this.buf.includes(MARKER_OPEN) ? this.buf.length - this.buf.lastIndexOf(MARKER_OPEN) : 0,
      longestSuffixThatPrefixes(this.buf, FENCE),
      longestSuffixThatPrefixes(this.buf, MARKER_OPEN),
    );
    const release = this.buf.slice(0, this.buf.length - hold);
    if (release) out.push({ type: 'text', delta: release });
    this.buf = this.buf.slice(this.buf.length - hold);
    return out;
  }

  finish(): Array<ParsedPart> {
    const out: Array<ParsedPart> = [];
    if (this.inFollowups) {
      const end = this.followupsBuf.indexOf('```');
      const block = end === -1 ? this.followupsBuf : this.followupsBuf.slice(0, end);
      const prompts = parseFollowups(block);
      if (prompts.length) out.push({ type: 'followups', prompts });
      this.followupsBuf = '';
      this.inFollowups = false;
      return out;
    }
    if (this.buf) out.push({ type: 'text', delta: this.buf });
    this.buf = '';
    return out;
  }
}
