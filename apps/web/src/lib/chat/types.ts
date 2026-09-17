export interface TextPart {
  readonly kind: 'text';
  text: string;
}
export interface CitePart {
  readonly kind: 'cite';
  readonly id: string;
  readonly ordinal: number;
  /** The cited Node's title (chips). */
  readonly title: string;
  /** The words in the Answer this Citation underlines; empty when only the superscript shows. */
  readonly label: string;
}
export type Part = TextPart | CitePart;

export interface Message {
  readonly role: 'visitor' | 'answer';
  readonly suggested?: boolean;
  parts: Part[];
  streaming: boolean;
  error?: string;
}

/**
 * Cells of one Markdown table row, each a list of parts, so a Citation stays inside the cell it was
 * written in. The outer pipes produce empty edge cells, which are dropped.
 */
export const tableCells = (row: ReadonlyArray<Part>): Array<Array<Part>> => {
  const cells: Array<Array<Part>> = [[]];
  for (const p of row) {
    if (p.kind === 'cite') {
      cells[cells.length - 1]!.push(p);
      continue;
    }
    p.text.split('|').forEach((seg, i) => {
      if (i > 0) cells.push([]);
      if (seg) cells[cells.length - 1]!.push({ kind: 'text', text: seg });
    });
  }
  const blank = (c: Array<Part>) => c.every((p) => p.kind === 'text' && !p.text.trim());
  while (cells.length && blank(cells[0]!)) cells.shift();
  while (cells.length && blank(cells[cells.length - 1]!)) cells.pop();
  return cells;
};

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
