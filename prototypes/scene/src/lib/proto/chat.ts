// PROTOTYPE: shared chat state shape + message rendering helper used by all three panel variants.
export interface Segment { kind: 'text'; text: string }
export interface Cite { kind: 'cite'; nodeId: number; ordinal: number; title: string }
export type Part = Segment | Cite;
export interface Message {
	role: 'visitor' | 'answer';
	suggested?: boolean;
	parts: Part[];
	streaming: boolean;
	error?: string;
}
export interface ChatProps {
	messages: Message[];
	followups: string[];
	hint: string;                 // the hint currently shown as ghost text in the prompt field
	attract: boolean;             // true while the idle loop is auto-playing hints
	streaming: boolean;
	onsend: (prompt: string) => void;
	onplayhint: () => void;       // empty submit: play the hint currently shown
	oncite: (nodeId: number) => void;
	oninput: (active: boolean) => void;
	focused: number | null;
	layout: 'top' | 'bottom' | 'middle';
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
