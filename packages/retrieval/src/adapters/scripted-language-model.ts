import { Layer, Stream } from 'effect';
import { LanguageModel, type LanguageModelShape, type LmInput } from '../services.ts';

const MARKER_RE = /\[\[([^\]]+)\]\]/g;

/**
 * Deterministic LanguageModel for tests, evals and offline dev: cites the ids it finds in the context
 * ("Most relevant" first), in a fixed shape, and emits a followups block. No network.
 */
export const scriptedAnswer = (input: LmInput): string => {
  const ctx = input.system.slice(input.system.indexOf('# Context'));
  const ids = [...new Set([...ctx.matchAll(MARKER_RE)].map((m) => m[1] ?? ''))].filter(Boolean);
  const nodeIds = ids.filter((id) => !id.includes('-->'));
  const edgeIds = ids.filter((id) => id.includes('-->'));
  const lastUser = [...input.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const lines: Array<string> = [];
  const isTable = input.system.includes('columns "Requirement" and "Evidence"');
  if (isTable) {
    lines.push('| Requirement | Evidence |', '| --- | --- |');
    nodeIds
      .slice(1, 5)
      .forEach((id, i) => lines.push(`| Requirement ${i + 1} | Evidence from [[${id}]] |`));
    lines.push('', `Overall a plausible fit on the items above [[${nodeIds[0] ?? ''}]].`);
  } else {
    lines.push(
      `Regarding "${lastUser.slice(0, 60)}": the most relevant items are ${nodeIds
        .slice(1, 4)
        .map((id) => `[[${id}]]`)
        .join(', ')} [[${nodeIds[0] ?? ''}]].`,
    );
    if (edgeIds[0])
      lines.push('', `Concretely, ${edgeIds[0].split('--')[0]} is linked by [[${edgeIds[0]}]].`);
  }
  lines.push(
    '',
    '```followups',
    '- What else did this involve?',
    '- Which skills were central?',
    '- Any measurable outcome?',
    '```',
  );
  return lines.join('\n');
};

export const scriptedLanguageModel = (
  options: { chunk?: number; model?: string } = {},
): LanguageModelShape => ({
  model: options.model ?? 'scripted',
  tier: 'primary',
  stream: (input) => {
    const text = scriptedAnswer(input);
    const size = options.chunk ?? 7;
    const parts: Array<string> = [];
    for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
    return Stream.fromArray(parts).pipe(
      Stream.map((delta) => ({ type: 'text', delta }) as const),
      Stream.concat(
        Stream.succeed({
          type: 'finish',
          usage: {
            tokensIn: Math.ceil(input.system.length / 4),
            tokensOut: Math.ceil(text.length / 4),
          },
        } as const),
      ),
    );
  },
});

export const ScriptedLanguageModelLayer = Layer.succeed(LanguageModel, scriptedLanguageModel());
