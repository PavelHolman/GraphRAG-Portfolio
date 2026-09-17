// PROTOTYPE: shared chat state shape + message rendering helper used by all three panel variants.
export interface Segment { kind: 'text'; text: string }
export interface Cite { kind: 'cite'; nodeId: number; ordinal: number; title: string }
export type Part = Segment | Cite;
export interface Message {
	role: 'visitor' | 'answer';
	parts: Part[];
	streaming: boolean;
	error?: string;
}
export interface ChatProps {
	messages: Message[];
	followups: string[];
	streaming: boolean;
	onsend: (prompt: string) => void;
	oncite: (nodeId: number) => void;
	focused: number | null;
}

// Split streamed markdown-ish text into lines so tables render as rows in the prototype.
export function lines(parts: Part[]): Part[][] {
	const out: Part[][] = [[]];
	for (const p of parts) {
		if (p.kind === 'cite') { out[out.length - 1].push(p); continue; }
		const chunks = p.text.split('\n');
		chunks.forEach((c, i) => { if (i > 0) out.push([]); if (c) out[out.length - 1].push({ kind: 'text', text: c }); });
	}
	return out;
}
