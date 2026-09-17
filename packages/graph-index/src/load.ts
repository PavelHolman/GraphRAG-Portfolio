import { Effect, FileSystem, Schema } from 'effect';
import YAML from 'yaml';
import {
  FRONTMATTER_BY_TYPE,
  type Frontmatter,
  HintsFile,
  NODE_TYPES,
  type NodeId,
  type NodeType,
  isNodeId,
} from '@graphrag/schema';
import { join } from 'node:path';
import { readTextIfExists } from './fs.ts';

export interface LoadedNode {
  readonly id: NodeId;
  readonly type: NodeType;
  readonly file: string;
  readonly frontmatter: Frontmatter;
  readonly body: string;
}

export interface ContentIssue {
  readonly file: string;
  readonly message: string;
}

export interface LoadedContent {
  readonly nodes: ReadonlyArray<LoadedNode>;
  readonly hints: ReadonlyArray<{ id: string; prompt: string }>;
  readonly issues: ReadonlyArray<ContentIssue>;
  /** SHA-256 over every source file, in path order. */
  readonly sources: ReadonlyArray<{ path: string; text: string }>;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export const splitFrontmatter = (text: string): { yaml: string; body: string } | undefined => {
  const m = FM_RE.exec(text);
  if (!m) return undefined;
  return { yaml: m[1] ?? '', body: (m[2] ?? '').trim() };
};

const parseYaml = (file: string, src: string): Effect.Effect<unknown, ContentIssue> =>
  Effect.try({
    try: () => YAML.parse(src) as unknown,
    catch: (e) => ({ file, message: `frontmatter is not valid YAML: ${String(e)}` }),
  });

/** Effect Schema issues, one line each: file, field path, message. */
const describeSchemaError = (file: string, err: Schema.SchemaError): ContentIssue => ({
  file,
  message: err.message.replace(/\s+/g, ' ').trim(),
});

const loadNode = (type: NodeType, dir: string, name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const file = join(dir, name);
    const slug = name.replace(/\.md$/, '');
    const id = `${type}/${slug}`;
    const text = yield* fs.readFileString(file);
    if (!isNodeId(id)) {
      return {
        issue: {
          file,
          message: `file name must be a lowercase slug ([a-z0-9-]), got ${JSON.stringify(slug)}`,
        },
        text,
      };
    }
    const parts = splitFrontmatter(text);
    if (!parts)
      return { issue: { file, message: 'missing frontmatter block (--- ... ---)' }, text };
    const raw = yield* parseYaml(file, parts.yaml).pipe(Effect.result);
    if (raw._tag === 'Failure') return { issue: raw.failure, text };
    const input =
      typeof raw.success === 'object' && raw.success !== null ? { ...raw.success, type } : { type };
    const decoded = yield* Schema.decodeUnknownEffect(FRONTMATTER_BY_TYPE[type], {
      onExcessProperty: 'error',
    })(input).pipe(Effect.result);
    if (decoded._tag === 'Failure')
      return { issue: describeSchemaError(file, decoded.failure), text };
    const node: LoadedNode = { id, type, file, frontmatter: decoded.success, body: parts.body };
    return { node, text };
  });

/** Reads every `content/<type>/<slug>.md` plus `content/hints.yaml`. Parse and per-file validation only. */
export const loadContent = (contentDir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const nodes: Array<LoadedNode> = [];
    const issues: Array<ContentIssue> = [];
    const sources: Array<{ path: string; text: string }> = [];
    for (const type of NODE_TYPES) {
      const dir = join(contentDir, type);
      if (!(yield* fs.exists(dir))) continue;
      const names = (yield* fs.readDirectory(dir)).filter((n) => n.endsWith('.md')).sort();
      for (const name of names) {
        const r = yield* loadNode(type, dir, name);
        sources.push({ path: join(type, name), text: r.text });
        if ('issue' in r && r.issue) issues.push(r.issue);
        else if ('node' in r && r.node) nodes.push(r.node);
      }
    }
    const hintsPath = join(contentDir, 'hints.yaml');
    const hintsText = yield* readTextIfExists(hintsPath);
    let hints: Array<{ id: string; prompt: string }> = [];
    if (hintsText !== undefined) {
      sources.push({ path: 'hints.yaml', text: hintsText });
      const raw = yield* parseYaml(hintsPath, hintsText).pipe(Effect.result);
      if (raw._tag === 'Failure') issues.push(raw.failure);
      else {
        const decoded = yield* Schema.decodeUnknownEffect(HintsFile)(raw.success).pipe(
          Effect.result,
        );
        if (decoded._tag === 'Failure')
          issues.push(describeSchemaError(hintsPath, decoded.failure));
        else hints = [...decoded.success.hints];
      }
    }
    return { nodes, hints, issues, sources } satisfies LoadedContent;
  });
