import { describe, expect, test } from 'bun:test';
import { Effect, FileSystem } from 'effect';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import { check } from '../src/build.ts';
import { deriveSpans } from '../src/derive.ts';
import { loadContent } from '../src/load.ts';
import { validate } from '../src/validate.ts';

const fixtures = `${import.meta.dir}/fixtures`;
/** The tests read real fixture files, so they run on the Node FileSystem layer. */
const provided = <A, E>(e: Effect.Effect<A, E, FileSystem.FileSystem>) =>
  e.pipe(Effect.provide(NodeFileSystem.layer));

describe('loadContent + validate', () => {
  test('a valid corpus loads with no issues and resolves Edges', async () => {
    const { content, validated, issues } = await Effect.runPromise(
      provided(check(`${fixtures}/valid`)),
    );
    expect(issues).toEqual([]);
    expect(content.nodes.map((n) => n.id).sort()).toEqual([
      'experience/lead',
      'organization/acme',
      'person/me',
      'project/pipeline',
      'skill/effect',
      'skill/typescript',
    ]);
    expect(validated.edges.map((e) => e.id)).toContain('project/pipeline--uses-->skill/effect');
    expect(
      validated.edges.find((e) => e.id === 'project/pipeline--uses-->skill/effect')?.note,
    ).toBe('typed streams end to end');
    expect(content.hints).toHaveLength(2);
  });
  test('broken content reports one line per problem, naming the file', async () => {
    const { issues } = await Effect.runPromise(provided(check(`${fixtures}/broken`)));
    const messages = issues.map((i) => `${i.file.split('/').slice(-2).join('/')}: ${i.message}`);
    expect(messages.some((m) => m.startsWith('skill/nocategory.md:') && /category/.test(m))).toBe(
      true,
    );
    expect(
      messages.some(
        (m) =>
          m.startsWith('project/dangling.md:') && /dangling reference "skill\/missing"/.test(m),
      ),
    ).toBe(true);
    expect(messages.some((m) => m.startsWith('skill/orphan.md:') && /orphan/.test(m))).toBe(true);
    expect(messages.some((m) => m.startsWith('organization/badedge.md:') && /uses/.test(m))).toBe(
      true,
    );
    expect(messages.some((m) => m.startsWith('experience/nostart.md:'))).toBe(true);
    expect(messages.some((m) => /alias "TS" collides/.test(m))).toBe(true);
  });
  test('derived Skill spans come from the Experiences and Projects that use them', async () => {
    const content = await Effect.runPromise(provided(loadContent(`${fixtures}/valid`)));
    const { edges } = validate(content.nodes);
    const spans = deriveSpans(content.nodes, edges);
    const effect = spans.get('skill/effect' as never);
    expect(effect?.start.toString()).toBe('2022-01');
    expect(effect?.end).toBeUndefined();
    const ts = spans.get('skill/typescript' as never);
    expect(ts?.start.toString()).toBe('2022-01');
  });
});
