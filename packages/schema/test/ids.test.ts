import { describe, expect, test } from 'bun:test';
import { Schema } from 'effect';
import { EdgeId, NodeId, edgeId, isNodeId, nodeTypeOf, parseEdgeId } from '../src/ids.ts';

describe('NodeId', () => {
  test('accepts <type>/<slug>', () => {
    expect(Schema.decodeUnknownSync(NodeId)('skill/effect')).toBe('skill/effect');
    expect(isNodeId('experience/staff-engineer-2021')).toBe(true);
  });
  test('rejects unknown types and bad slugs', () => {
    expect(isNodeId('thing/x')).toBe(false);
    expect(isNodeId('skill/Effect')).toBe(false);
    expect(isNodeId('skill/-x')).toBe(false);
    expect(() => Schema.decodeUnknownSync(NodeId)('skill')).toThrow();
  });
  test('nodeTypeOf', () => {
    expect(nodeTypeOf('project/ingestion' as never)).toBe('project');
  });
});

describe('EdgeId', () => {
  test('round-trips through edgeId and parseEdgeId', () => {
    const id = edgeId('project/ingestion' as never, 'uses', 'skill/effect' as never);
    expect(id).toBe('project/ingestion--uses-->skill/effect');
    expect(parseEdgeId(id)).toEqual({
      source: 'project/ingestion',
      type: 'uses',
      target: 'skill/effect',
    });
    expect(Schema.decodeUnknownSync(EdgeId)(id)).toBe(id);
  });
  test('rejects malformed ids', () => {
    expect(parseEdgeId('project/ingestion--uses->skill/effect')).toBeUndefined();
    expect(parseEdgeId('project/ingestion--owns-->skill/effect')).toBeUndefined();
  });
});
