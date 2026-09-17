// PROTOTYPE: fake Turn stream shaped like ADR 0003 events, driven by timers. No network.
import type { Graph, Subgraph } from './graph';

export type TurnEvent =
	| { type: 'turn-started'; turnId: string; mode: 'match' | 'entity' | 'hybrid' }
	| { type: 'subgraph'; nodeIds: number[]; edgeIds: number[]; seedIds: number[] }
	| { type: 'text'; delta: string }
	| { type: 'citation'; nodeId: number; ordinal: number }
	| { type: 'followups'; prompts: string[] }
	| { type: 'turn-finished'; usedNodeIds: number[]; usedEdgeIds: number[] }
	| { type: 'error'; message: string; retryable: boolean };

interface Script { match: RegExp; mode: 'match' | 'entity' | 'hybrid'; seeds: string[]; answer: string; followups: string[] }

// [[Title]] markers are resolved to node indices at runtime.
const SCRIPTS: Script[] = [
	{
		match: /effect/i, mode: 'entity', seeds: ['Effect', 'TypeScript', 'Streaming Ingestion'],
		answer: `Most of my recent backend work is built on [[Effect]] with [[TypeScript]]. The clearest example is the [[Streaming Ingestion]] platform at [[Acme Bank]], where I used Effect Streams and Schedule-based retries to process around 40k events per second with typed errors end to end.

I also used it for dependency injection and resiliency in the [[Payments Ledger]], and I lean on it for structured concurrency whenever a service fans out to several upstreams.`,
		followups: ['What did Effect replace in the ledger?', 'How do you test Effect code?', 'Which Effect modules do you use most?']
	},
	{
		match: /kubernetes|kafka|lead|job|role|requirement/i, mode: 'match', seeds: ['Kubernetes', 'Kafka', 'Leadership', 'Staff Engineer'],
		answer: `| Requirement | Evidence |
| --- | --- |
| Kubernetes in production | Ran the [[Observability Stack]] and [[Auth Gateway]] on [[Kubernetes]] at [[Acme Bank]] |
| Event streaming | [[Kafka]] backs the [[Streaming Ingestion]] pipeline and [[Fraud Detection]] |
| Technical leadership | As [[Staff Engineer]] I led [[Billing Migration]] and mentored a team of six ([[Leadership]]) |

Overall a strong match on platform and streaming, with leadership evidence from the last three years.`,
		followups: ['Tell me more about the billing migration', 'What was the team size and structure?', 'Any gaps against this role?']
	},
	{
		match: /stud|educat|degree|university/i, mode: 'entity', seeds: ['MSc Computer Science'],
		answer: `I hold an [[MSc Computer Science]] from [[Univ. of Prague]]. The programme grounded me in [[Distributed Systems]], [[Data Modeling]], [[SQL]] and [[Python]], which is where my interest in event-driven architecture started.`,
		followups: ['What was your thesis about?', 'Which courses shaped your work most?', 'Any certifications since?']
	}
];

const FALLBACK: Script = {
	match: /.*/, mode: 'hybrid', seeds: ['Pavel'],
	answer: `I'm [[Pavel]], a staff-level engineer working across [[Frontend]], [[Backend]] and [[DevOps]], mostly in [[Fintech]] and [[Developer Tooling]]. Ask me about a specific project, a technology, or paste a job description and I'll map it to what I've done.`,
	followups: ['What are you strongest at?', 'Show me your most recent project', 'Paste a job description']
};

function expand(g: Graph, seeds: number[], hops: number) {
	const nodes = new Set(seeds); const edges = new Set<number>(); let frontier = new Set(seeds);
	for (let h = 0; h < hops; h++) {
		const next = new Set<number>();
		g.edges.forEach((e, ei) => {
			if (frontier.has(e.src) || frontier.has(e.dst)) {
				edges.add(ei);
				if (!nodes.has(e.src)) { nodes.add(e.src); next.add(e.src); }
				if (!nodes.has(e.dst)) { nodes.add(e.dst); next.add(e.dst); }
			}
		});
		frontier = next;
	}
	nodes.add(0);
	return { nodes: [...nodes], edges: [...edges] };
}

export function fakeTurn(g: Graph, prompt: string, signal: AbortSignal, onEvent: (e: TurnEvent) => void) {
	const byTitle = new Map(g.nodes.map((n, i) => [n.title, i]));
	const script = SCRIPTS.find((s) => s.match.test(prompt)) ?? FALLBACK;
	const seeds = script.seeds.map((t) => byTitle.get(t)!).filter((i) => i != null);
	const cand = expand(g, seeds, script.mode === 'match' ? 2 : 1);
	const candSet = new Set(cand.nodes);
	const wait = (ms: number) => new Promise<void>((res, rej) => {
		const t = setTimeout(res, ms);
		signal.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); }, { once: true });
	});
	(async () => {
		try {
			onEvent({ type: 'turn-started', turnId: Math.random().toString(36).slice(2), mode: script.mode });
			await wait(350); // "retrieval"
			onEvent({ type: 'subgraph', nodeIds: cand.nodes, edgeIds: cand.edges, seedIds: seeds });
			await wait(500); // "first token"
			const used = new Set<number>();
			let ordinal = 0;
			const tokens = script.answer.split(/(\[\[[^\]]+\]\]|\s+)/).filter((t) => t.length);
			for (const tok of tokens) {
				const m = tok.match(/^\[\[(.+)\]\]$/);
				if (m) {
					const id = byTitle.get(m[1]);
					if (id != null && candSet.has(id)) { used.add(id); onEvent({ type: 'citation', nodeId: id, ordinal: ordinal++ }); }
					onEvent({ type: 'text', delta: m[1] });
				} else {
					onEvent({ type: 'text', delta: tok });
				}
				await wait(/\s+/.test(tok) ? 8 : 28);
			}
			await wait(200);
			onEvent({ type: 'followups', prompts: script.followups });
			const usedEdges = cand.edges.filter((ei) => used.has(g.edges[ei].src) && used.has(g.edges[ei].dst));
			onEvent({ type: 'turn-finished', usedNodeIds: [...used], usedEdgeIds: usedEdges });
		} catch (e) {
			if ((e as DOMException).name !== 'AbortError') onEvent({ type: 'error', message: String(e), retryable: true });
		}
	})();
}

export function emptySubgraph(): Subgraph {
	return { name: '', seeds: new Set(), nodes: new Set(), edges: new Set() };
}
