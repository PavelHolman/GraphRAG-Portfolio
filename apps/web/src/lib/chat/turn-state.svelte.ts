// Client-side Turn state machine: applies ADR 0003 events to the chat messages and the Scene
// Subgraph exactly as docs/spec/chat.md prescribes. Pure with respect to the DOM.
import type { HistoryTurn, TurnEvent, TurnRequest } from '@graphrag/schema';
import type { SceneGraph, Subgraph } from '$lib/scene/types.ts';
import { streamTurn } from './client.ts';
import type { CitePart, Message } from './types.ts';

/** How far back in the streamed text a Citation may reach to underline its mention. */
const MENTION_WINDOW = 240;

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
      const at = hay.lastIndexOf(needle);
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

export class TurnState {
  messages = $state<Message[]>([]);
  followups = $state<string[]>([]);
  streaming = $state(false);
  focused = $state<string | null>(null);
  subgraph = $state<Subgraph | null>(null);
  private abort: AbortController | null = null;
  private runCounter = 0;
  private previousUsedIds: string[] = [];
  private readonly nodeIndex: Map<string, number>;
  private readonly edgeIndex: Map<string, number>;

  constructor(private readonly graph: SceneGraph) {
    this.nodeIndex = new Map(graph.nodes.map((n, i) => [n.id, i]));
    this.edgeIndex = new Map(graph.edges.map((e, i) => [e.id, i]));
  }

  /** Close the conversation: abort anything in flight and return the Scene to rest. */
  reset(): void {
    this.abort?.abort();
    this.runCounter++;
    this.messages = [];
    this.followups = [];
    this.streaming = false;
    this.focused = null;
    this.subgraph = null;
    this.previousUsedIds = [];
  }

  focusNodeIndex(): number | null {
    return this.focused === null ? null : (this.nodeIndex.get(this.focused) ?? null);
  }

  private history(): HistoryTurn[] {
    const out: HistoryTurn[] = [];
    for (let i = 0; i + 1 < this.messages.length; i += 2) {
      const q = this.messages[i];
      const a = this.messages[i + 1];
      if (q?.role !== 'visitor' || a?.role !== 'answer') continue;
      const text = (m: Message) =>
        m.parts.map((p) => (p.kind === 'text' ? p.text : p.title)).join('');
      out.push({ prompt: text(q), answer: text(a) });
    }
    return out.slice(-3).filter((h) => h.prompt.length + h.answer.length < 1800);
  }

  run(prompt: string, source: 'typed' | 'hint' | 'followup'): void {
    // New Prompt mid-stream: abort, mark the previous Answer done, keep its Highlight until `subgraph`.
    this.abort?.abort();
    const last = this.messages.at(-1);
    if (last?.streaming) last.streaming = false;
    this.abort = new AbortController();
    const runId = ++this.runCounter;
    const history = this.history();
    this.followups = [];
    this.focused = null;
    this.messages.push({
      role: 'visitor',
      suggested: source === 'hint',
      parts: [{ kind: 'text', text: prompt }],
      streaming: false,
    });
    this.messages.push({ role: 'answer', parts: [], streaming: true });
    this.streaming = true;

    let live: Subgraph = { seeds: new Set(), nodes: new Set(), edges: new Set() };
    let candidateNodes = new Set<number>();
    let candidateEdges = new Set<number>();
    const request: TurnRequest = {
      prompt,
      source,
      history,
      ...(this.previousUsedIds.length ? { previousUsedIds: this.previousUsedIds } : {}),
    };
    let terminal = false;
    const finish = () => {
      const a = this.messages.at(-1);
      if (a) a.streaming = false;
      this.streaming = false;
    };
    streamTurn(request, this.abort.signal, (e: TurnEvent) => {
      // Events from an aborted run may still be in flight; only the current run may touch state.
      if (runId !== this.runCounter) return;
      const a = this.messages.at(-1);
      if (!a) return;
      if (e.type === 'turn-finished' || e.type === 'error') terminal = true;
      switch (e.type) {
        case 'turn-started':
          break;
        case 'subgraph': {
          candidateNodes = new Set(
            e.nodeIds
              .map((id) => this.nodeIndex.get(id))
              .filter((i): i is number => i !== undefined),
          );
          candidateEdges = new Set(
            e.edgeIds
              .map((id) => this.edgeIndex.get(id))
              .filter((i): i is number => i !== undefined),
          );
          live = { seeds: new Set(), nodes: candidateNodes, edges: candidateEdges };
          this.subgraph = live;
          break;
        }
        case 'text': {
          const lastPart = a.parts.at(-1);
          if (lastPart?.kind === 'text') lastPart.text += e.delta;
          else a.parts.push({ kind: 'text', text: e.delta });
          break;
        }
        case 'citation': {
          const ni = this.nodeIndex.get(e.id);
          const ei = this.edgeIndex.get(e.id);
          const edge = ei !== undefined ? this.graph.edges[ei] : undefined;
          const title =
            ni !== undefined ? (this.graph.nodes[ni]?.title ?? e.id) : (this.edgeTitle(ei) ?? e.id);
          const names =
            ni !== undefined
              ? [this.graph.nodes[ni]?.title ?? '']
              : [
                  this.graph.nodes[edge?.target ?? -1]?.title ?? '',
                  this.graph.nodes[edge?.source ?? -1]?.title ?? '',
                ];
          attachCitation(
            a,
            { kind: 'cite', id: e.id, ordinal: e.ordinal, title, label: '' },
            names,
          );
          const seeds = new Set(live.seeds);
          if (ni !== undefined) seeds.add(ni);
          if (ei !== undefined) {
            const edge = this.graph.edges[ei];
            if (edge) {
              seeds.add(edge.source);
              seeds.add(edge.target);
            }
          }
          live = { ...live, seeds };
          this.subgraph = live;
          break;
        }
        case 'followups':
          this.followups = [...e.prompts];
          break;
        case 'turn-finished': {
          // seeds = used Nodes; nodes = used ∪ their candidate neighbours ∪ Person; edges = candidate edges touching a used Node.
          const used = new Set(
            e.usedNodeIds
              .map((id) => this.nodeIndex.get(id))
              .filter((i): i is number => i !== undefined),
          );
          const keep = new Set<number>([...used, this.graph.person]);
          const edges = new Set<number>();
          for (const ei of candidateEdges) {
            const edge = this.graph.edges[ei];
            if (!edge) continue;
            if (used.has(edge.source) && candidateNodes.has(edge.target)) keep.add(edge.target);
            if (used.has(edge.target) && candidateNodes.has(edge.source)) keep.add(edge.source);
          }
          for (const ei of candidateEdges) {
            const edge = this.graph.edges[ei];
            if (
              edge &&
              keep.has(edge.source) &&
              keep.has(edge.target) &&
              (used.has(edge.source) || used.has(edge.target))
            )
              edges.add(ei);
          }
          this.subgraph = { seeds: used, nodes: keep, edges };
          this.previousUsedIds = [...e.usedNodeIds, ...e.usedEdgeIds].slice(0, 60);
          finish();
          break;
        }
        case 'error':
          a.error = e.message;
          finish();
          break;
      }
    })
      .then(() => {
        if (runId !== this.runCounter || terminal) return;
        const a = this.messages.at(-1);
        if (a) a.error = 'The answer ended early. Try again.';
        finish();
      })
      .catch((err: unknown) => {
        if (runId !== this.runCounter || (err as { name?: string }).name === 'AbortError') return;
        const a = this.messages.at(-1);
        if (a) a.error = String(err);
        finish();
      });
  }

  private edgeTitle(ei: number | undefined): string | undefined {
    if (ei === undefined) return undefined;
    const e = this.graph.edges[ei];
    if (!e) return undefined;
    return `${this.graph.nodes[e.source]?.title ?? ''} → ${this.graph.nodes[e.target]?.title ?? ''}`;
  }
}
