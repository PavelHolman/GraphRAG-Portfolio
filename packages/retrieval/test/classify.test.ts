import { describe, expect, test } from 'bun:test';
import { classify, requirementLines } from '../src/classify.ts';
import { fixtureIndex } from './fixture.ts';

const graph = fixtureIndex();

describe('classify', () => {
  test('a title in a short prompt is entity mode with that Node', () => {
    const c = classify('Tell me about your Effect work', graph);
    expect(c.mode).toBe('entity');
    expect(c.matchedNodes.map((i) => graph.nodes[i]?.id)).toEqual(['skill/effect']);
  });
  test('aliases match too', () => {
    const c = classify('any k8s experience?', graph);
    expect(c.matchedNodes.map((i) => graph.nodes[i]?.id)).toEqual(['skill/kubernetes']);
  });
  test('a single-word title needs its own casing; multi-word names match loosely', () => {
    expect(classify('what effect did your work have?', graph).mode).toBe('hybrid');
    expect(
      classify('Tell me about Effect', graph).matchedNodes.map((i) => graph.nodes[i]?.id),
    ).toEqual(['skill/effect']);
    expect(
      classify('tell me about the streaming ingestion work', graph).matchedNodes.map(
        (i) => graph.nodes[i]?.id,
      ),
    ).toEqual(['project/ingestion']);
  });
  test('a Node Type name seeds every Node of that type', () => {
    const c = classify('where did you get your education?', graph);
    expect(c.mode).toBe('entity');
    expect(c.matchedType).toBe('education');
  });
  test('a long, bulleted job description is match mode', () => {
    const jd = [
      'We are hiring a platform lead.',
      '- 5+ years running services on Kubernetes',
      '- Event streaming with Kafka or Pulsar',
      '- Mentoring engineers',
      '- TypeScript or Go',
    ].join('\n');
    expect(classify(jd, graph).mode).toBe('match');
    expect(requirementLines(jd)).toHaveLength(5);
  });
  test('hidden Nodes never match', () => {
    expect(classify('tell me about the secret skill', graph).matchedNodes).toEqual([]);
  });
  test('everything else is hybrid', () => {
    expect(classify('how do you approach testing in event-driven systems', graph).mode).toBe(
      'hybrid',
    );
  });
});
