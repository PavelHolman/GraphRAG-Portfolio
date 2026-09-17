export interface TextPart {
  readonly kind: 'text';
  text: string;
}
export interface CitePart {
  readonly kind: 'cite';
  readonly id: string;
  readonly ordinal: number;
  readonly title: string;
}
export type Part = TextPart | CitePart;

export interface Message {
  readonly role: 'visitor' | 'answer';
  readonly suggested?: boolean;
  parts: Part[];
  streaming: boolean;
  error?: string;
}

/** Split streamed Markdown-ish text into rows so tables render as rows without a Markdown library. */
export const rows = (parts: ReadonlyArray<Part>): Array<Array<Part>> => {
  const out: Array<Array<Part>> = [[]];
  for (const p of parts) {
    if (p.kind === 'cite') {
      out[out.length - 1]!.push(p);
      continue;
    }
    const chunks = p.text.split('\n');
    chunks.forEach((c, i) => {
      if (i > 0) out.push([]);
      if (c) out[out.length - 1]!.push({ kind: 'text', text: c });
    });
  }
  return out;
};
