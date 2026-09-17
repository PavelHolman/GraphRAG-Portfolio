import type { NodeType, TurnMode } from '@graphrag/schema';
import { NODE_TYPES } from '@graphrag/schema';
import type { GraphIndex } from './graph.ts';

export interface Classification {
  readonly mode: TurnMode;
  /** Node indices matched by title or alias (entity mode). */
  readonly matchedNodes: ReadonlyArray<number>;
  /** A Node Type named in the Prompt (entity mode, "your education"). */
  readonly matchedType: NodeType | undefined;
}

const TYPE_WORDS: Record<NodeType, ReadonlyArray<string>> = {
  person: [],
  skill: ['skills', 'skill set', 'tech stack', 'technologies'],
  project: ['projects'],
  experience: ['experience', 'work history', 'career', 'jobs', 'roles'],
  education: ['education', 'studies', 'degree', 'degrees', 'university'],
  organization: ['employers', 'companies', 'organizations'],
  domain: ['domains', 'industries'],
};

const tokenize = (s: string): string =>
  ` ${s
    .replace(/[^\p{L}\p{N}.+#]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

export const normalizeText = (s: string): string => tokenize(s).toLowerCase();

export const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/** Heuristic classification; no LLM. ADR 0004 stage 1. */
export const classify = (prompt: string, graph: GraphIndex): Classification => {
  const words = wordCount(prompt);
  const lineBreaks = (prompt.match(/\n/g) ?? []).length;
  const bullets = (prompt.match(/^\s*(?:[-*•]|\d+[.)])\s+/gm) ?? []).length;
  const text = normalizeText(prompt);
  const textCased = tokenize(prompt);

  // A pasted job description names many titles; its shape decides before any title match does.
  if (words > 80 || lineBreaks >= 3 || bullets >= 3) {
    return { mode: 'match', matchedNodes: [], matchedType: undefined };
  }

  const matchedNodes: Array<number> = [];
  if (words <= 16) {
    graph.nodes.forEach((n, i) => {
      if (n.hidden || n.type === 'person') return;
      // A single-word name only counts when written with its own casing ("Effect", "DX"), so an
      // ordinary word in a question does not hijack the Prompt; multi-word names match loosely.
      const hit = [n.title, ...(n.aliases ?? [])].some((raw) => {
        const cased = tokenize(raw).trim();
        if (cased.length < 2) return false;
        return cased.includes(' ')
          ? text.includes(` ${cased.toLowerCase()} `)
          : textCased.includes(` ${cased} `);
      });
      if (hit) matchedNodes.push(i);
    });
  }
  let matchedType: NodeType | undefined;
  if (words <= 12) {
    for (const t of NODE_TYPES) {
      if (TYPE_WORDS[t].some((w) => text.includes(` ${w} `))) {
        matchedType = t;
        break;
      }
    }
  }
  if (matchedNodes.length > 0 || matchedType !== undefined) {
    return { mode: 'entity', matchedNodes, matchedType };
  }
  return { mode: 'hybrid', matchedNodes: [], matchedType: undefined };
};

/** Requirement lines of a pasted job description: bullets and sentences, short ones dropped. */
export const requirementLines = (prompt: string): Array<string> => {
  const lines = prompt
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .flatMap((l) => (l.length > 160 ? l.split(/(?<=[.;])\s+/) : [l]))
    .map((l) => l.trim())
    .filter((l) => wordCount(l) >= 2);
  return lines.slice(0, 40);
};
