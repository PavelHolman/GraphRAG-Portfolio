// PROTOTYPE: throwaway fake Knowledge Graph + three layouts. Not production code.
// Question: does a precomputed force layout with cluster gravity read well for a few
// hundred Nodes, or is a designed layout needed? Also: highlight language, delta
// animation, mobile frame rate and touch controls.

export type NodeType =
	| 'person'
	| 'skill'
	| 'project'
	| 'experience'
	| 'education'
	| 'organization'
	| 'domain';

export interface GNode {
	id: string;
	type: NodeType;
	title: string;
	degree: number;
}
export interface GEdge {
	id: string;
	src: number;
	dst: number;
	type: string;
}
export interface Graph {
	nodes: GNode[];
	edges: GEdge[];
}
export interface Subgraph {
	name: string;
	seeds: Set<number>;
	nodes: Set<number>;
	edges: Set<number>;
}

export const TYPE_COLOR: Record<NodeType, string> = {
	person: '#ffd166',
	skill: '#4cc9f0',
	project: '#80ed99',
	experience: '#f4a261',
	education: '#c77dff',
	organization: '#2ec4b6',
	domain: '#ff7096'
};

export const TYPE_ORDER: NodeType[] = [
	'person',
	'experience',
	'project',
	'skill',
	'education',
	'organization',
	'domain'
];

// Deterministic PRNG so every reload shows the same graph.
function rng(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967296;
	};
}

export function makeGraph(): Graph {
	const r = rng(42);
	const nodes: GNode[] = [];
	const edges: GEdge[] = [];
	const add = (type: NodeType, title: string) => {
		nodes.push({ id: `${type}/${title.toLowerCase().replace(/\W+/g, '-')}`, type, title, degree: 0 });
		return nodes.length - 1;
	};
	const link = (src: number, dst: number, type: string) => {
		edges.push({ id: `${nodes[src].id}--${type}-->${nodes[dst].id}`, src, dst, type });
		nodes[src].degree++;
		nodes[dst].degree++;
	};

	const person = add('person', 'Pavel');
	const orgs = ['Acme Bank', 'Northwind', 'Contoso Labs', 'Univ. of Prague', 'OSS Community', 'Fabrikam'].map(
		(t) => add('organization', t)
	);
	const domains = ['Fintech', 'E-commerce', 'Developer Tooling', 'Healthcare', 'Logistics'].map((t) =>
		add('domain', t)
	);
	const skillNames = [
		'TypeScript', 'Effect', 'Svelte', 'SvelteKit', 'Three.js', 'Node.js', 'Bun', 'PostgreSQL', 'Kafka',
		'Kubernetes', 'Docker', 'AWS', 'Cloudflare', 'GraphQL', 'REST', 'Event Sourcing', 'CQRS', 'DDD',
		'Testing', 'Playwright', 'Vitest', 'React', 'Next.js', 'Tailwind', 'Rust', 'Go', 'Python', 'C#',
		'.NET', 'Redis', 'RabbitMQ', 'gRPC', 'OpenTelemetry', 'Grafana', 'Terraform', 'GitHub Actions',
		'Leadership', 'Mentoring', 'Architecture', 'Frontend', 'Backend', 'DevOps', 'Data Modeling',
		'Streaming', 'WebGL', 'Accessibility', 'i18n', 'Security', 'OAuth', 'Performance', 'Caching',
		'Monorepos', 'CI/CD', 'Observability', 'Agile', 'Product Thinking', 'Technical Writing',
		'Public Speaking', 'Hiring', 'Code Review', 'Pair Programming', 'System Design', 'Distributed Systems',
		'Microservices', 'Serverless', 'Edge Computing', 'Vector Search', 'RAG', 'LLM Integration',
		'Prompt Engineering', 'Embeddings', 'Graph Databases', 'Neo4j', 'SQL', 'NoSQL', 'MongoDB', 'ETL',
		'Data Pipelines', 'Message Queues', 'WebSockets', 'SSE', 'HTTP/2', 'TLS', 'Linux', 'Bash', 'Nix',
		'macOS', 'iOS', 'Swift', 'Kotlin', 'Android', 'Flutter', 'Electron', 'Tauri', 'CSS', 'HTML', 'SVG',
		'D3', 'Charts', 'Figma', 'Design Systems', 'UX', 'Copywriting'
	];
	const skills = skillNames.map((t) => add('skill', t));
	// skill hierarchy
	const broad: Record<string, string[]> = {
		Frontend: ['Svelte', 'SvelteKit', 'React', 'Next.js', 'Tailwind', 'CSS', 'HTML', 'SVG', 'Three.js', 'WebGL'],
		Backend: ['Node.js', 'Bun', 'PostgreSQL', 'REST', 'GraphQL', 'gRPC', 'Redis'],
		DevOps: ['Kubernetes', 'Docker', 'AWS', 'Cloudflare', 'Terraform', 'GitHub Actions', 'CI/CD'],
		Architecture: ['Event Sourcing', 'CQRS', 'DDD', 'System Design', 'Distributed Systems', 'Microservices'],
		Leadership: ['Mentoring', 'Hiring', 'Code Review', 'Agile']
	};
	const byTitle = new Map(nodes.map((n, i) => [n.title, i]));
	for (const [b, kids] of Object.entries(broad)) for (const k of kids) link(byTitle.get(k)!, byTitle.get(b)!, 'part-of');

	const experiences = [
		['Staff Engineer', 0], ['Senior Engineer', 1], ['Tech Lead', 2], ['Engineer', 1], ['Founder', 5],
		['Consultant', 0], ['Intern', 3], ['Maintainer', 4]
	] as const;
	const exps = experiences.map(([t, o]) => {
		const e = add('experience', t);
		link(e, orgs[o], 'at');
		link(e, domains[Math.floor(r() * domains.length)], 'in-domain');
		return e;
	});
	const edu = add('education', 'MSc Computer Science');
	link(edu, orgs[3], 'at');
	for (const s of ['SQL', 'Python', 'Distributed Systems', 'Data Modeling']) link(edu, byTitle.get(s)!, 'taught');

	const projectNames = [
		'Streaming Ingestion', 'Payments Ledger', 'Checkout Redesign', 'Design System', 'Observability Stack',
		'Search Service', 'Recommendation Engine', 'Mobile App', 'Internal CLI', 'GraphRAG Portfolio',
		'Fraud Detection', 'Warehouse Sync', 'Patient Portal', 'Order Tracking', 'Billing Migration',
		'Auth Gateway', 'Feature Flags', 'Notification Hub', 'Reporting Dashboard', 'Data Lake', 'Edge Cache',
		'Chat Support Bot', 'Onboarding Flow', 'Pricing Engine', 'Inventory Service', 'Marketplace API',
		'Docs Site', 'Component Library', 'Load Testing Rig', 'Schema Registry', 'ETL Orchestrator',
		'Analytics SDK', 'Kiosk UI', 'Admin Console', 'Partner Portal', 'Tax Calculator', 'Rate Limiter',
		'Media Pipeline', 'Geo Service', 'A/B Platform'
	];
	for (const p of projectNames) {
		const pi = add('project', p);
		const e = exps[Math.floor(r() * exps.length)];
		link(e, pi, r() < 0.3 ? 'led' : 'delivered');
		link(pi, domains[Math.floor(r() * domains.length)], 'in-domain');
		const n = 2 + Math.floor(r() * 5);
		const used = new Set<number>();
		for (let k = 0; k < n; k++) used.add(skills[Math.floor(r() * skills.length)]);
		for (const s of used) link(pi, s, 'uses');
	}
	for (const e of exps) {
		const n = 3 + Math.floor(r() * 6);
		const used = new Set<number>();
		for (let k = 0; k < n; k++) used.add(skills[Math.floor(r() * skills.length)]);
		for (const s of used) link(e, s, 'uses');
	}
	// related-to among skills
	for (let k = 0; k < 40; k++) {
		const a = skills[Math.floor(r() * skills.length)];
		const b = skills[Math.floor(r() * skills.length)];
		if (a !== b) link(a, b, 'related-to');
	}
	void person;
	return { nodes, edges };
}

// ---------- layouts (each returns Float32Array xyz per node) ----------

export function forceLayout(g: Graph, iterations = 350): Float32Array {
	const r = rng(7);
	const n = g.nodes.length;
	const pos = new Float32Array(n * 3);
	const vel = new Float32Array(n * 3);
	// cluster centres on a ring by type, person at origin
	const centre: Record<NodeType, [number, number, number]> = {
		person: [0, 0, 0],
		experience: [0, 0, 0],
		project: [0, 0, 0],
		skill: [0, 0, 0],
		education: [0, 0, 0],
		organization: [0, 0, 0],
		domain: [0, 0, 0]
	};
	TYPE_ORDER.slice(1).forEach((t, i) => {
		const a = (i / 6) * Math.PI * 2;
		centre[t] = [Math.cos(a) * 9, (i % 2 ? 2 : -2), Math.sin(a) * 9];
	});
	for (let i = 0; i < n; i++) {
		const c = centre[g.nodes[i].type];
		pos[i * 3] = c[0] + (r() - 0.5) * 6;
		pos[i * 3 + 1] = c[1] + (r() - 0.5) * 6;
		pos[i * 3 + 2] = c[2] + (r() - 0.5) * 6;
	}
	const adj = g.edges;
	for (let it = 0; it < iterations; it++) {
		const t = 1 - it / iterations;
		// repulsion
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				let dx = pos[i * 3] - pos[j * 3];
				let dy = pos[i * 3 + 1] - pos[j * 3 + 1];
				let dz = pos[i * 3 + 2] - pos[j * 3 + 2];
				let d2 = dx * dx + dy * dy + dz * dz + 0.01;
				if (d2 > 64) continue;
				const f = (1.2 / d2) * t;
				dx *= f; dy *= f; dz *= f;
				vel[i * 3] += dx; vel[i * 3 + 1] += dy; vel[i * 3 + 2] += dz;
				vel[j * 3] -= dx; vel[j * 3 + 1] -= dy; vel[j * 3 + 2] -= dz;
			}
		}
		// springs
		for (const e of adj) {
			const dx = pos[e.dst * 3] - pos[e.src * 3];
			const dy = pos[e.dst * 3 + 1] - pos[e.src * 3 + 1];
			const dz = pos[e.dst * 3 + 2] - pos[e.src * 3 + 2];
			const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
			const f = ((d - 2.2) * 0.02) * t;
			vel[e.src * 3] += (dx / d) * f; vel[e.src * 3 + 1] += (dy / d) * f; vel[e.src * 3 + 2] += (dz / d) * f;
			vel[e.dst * 3] -= (dx / d) * f; vel[e.dst * 3 + 1] -= (dy / d) * f; vel[e.dst * 3 + 2] -= (dz / d) * f;
		}
		// cluster gravity + integrate
		for (let i = 0; i < n; i++) {
			const c = centre[g.nodes[i].type];
			const gk = g.nodes[i].type === 'person' ? 0.3 : 0.012;
			vel[i * 3] += (c[0] - pos[i * 3]) * gk;
			vel[i * 3 + 1] += (c[1] - pos[i * 3 + 1]) * gk;
			vel[i * 3 + 2] += (c[2] - pos[i * 3 + 2]) * gk;
			for (let k = 0; k < 3; k++) {
				vel[i * 3 + k] *= 0.6;
				pos[i * 3 + k] += vel[i * 3 + k];
			}
		}
	}
	return pos;
}

// Concentric shells by type: person centre, experience inner, project middle, skill outer, others between.
export function shellLayout(g: Graph): Float32Array {
	const r = rng(11);
	const radius: Record<NodeType, number> = {
		person: 0, experience: 4, organization: 6, education: 6, project: 8.5, domain: 11, skill: 13
	};
	const groups = new Map<NodeType, number[]>();
	g.nodes.forEach((nd, i) => groups.set(nd.type, [...(groups.get(nd.type) ?? []), i]));
	const pos = new Float32Array(g.nodes.length * 3);
	for (const [t, idx] of groups) {
		const R = radius[t];
		// fibonacci sphere distribution per shell
		idx.forEach((i, k) => {
			if (R === 0) return;
			const phi = Math.acos(1 - (2 * (k + 0.5)) / idx.length);
			const theta = Math.PI * (1 + Math.sqrt(5)) * k + r() * 0.2;
			pos[i * 3] = R * Math.sin(phi) * Math.cos(theta);
			pos[i * 3 + 1] = R * Math.cos(phi) * 0.7;
			pos[i * 3 + 2] = R * Math.sin(phi) * Math.sin(theta);
		});
	}
	return pos;
}

// 2.5D layers: each type on its own horizontal plane, nodes force-spread in 2D within the plane.
export function layerLayout(g: Graph): Float32Array {
	const r = rng(23);
	const y: Record<NodeType, number> = {
		domain: 9, organization: 6, experience: 3, person: 3, project: 0, education: -3, skill: -6
	};
	const n = g.nodes.length;
	const pos = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const t = g.nodes[i].type;
		const spread = t === 'skill' ? 16 : t === 'project' ? 12 : 8;
		pos[i * 3] = (r() - 0.5) * spread;
		pos[i * 3 + 1] = y[t];
		pos[i * 3 + 2] = (r() - 0.5) * spread * 0.6;
	}
	if (n) { pos[0] = 0; pos[2] = 0; }
	// 2D relaxation within plane: repulsion + spring toward neighbours' x/z
	for (let it = 0; it < 200; it++) {
		for (let i = 1; i < n; i++) {
			let fx = 0, fz = 0;
			for (let j = 0; j < n; j++) {
				if (i === j || g.nodes[i].type !== g.nodes[j].type) continue;
				const dx = pos[i * 3] - pos[j * 3], dz = pos[i * 3 + 2] - pos[j * 3 + 2];
				const d2 = dx * dx + dz * dz + 0.05;
				if (d2 < 6) { fx += dx / d2 * 0.4; fz += dz / d2 * 0.4; }
			}
			pos[i * 3] += fx; pos[i * 3 + 2] += fz;
		}
		for (const e of g.edges) {
			if (e.src === 0 || e.dst === 0) continue;
			const dx = pos[e.dst * 3] - pos[e.src * 3], dz = pos[e.dst * 3 + 2] - pos[e.src * 3 + 2];
			pos[e.src * 3] += dx * 0.004; pos[e.src * 3 + 2] += dz * 0.004;
			pos[e.dst * 3] -= dx * 0.004; pos[e.dst * 3 + 2] -= dz * 0.004;
		}
	}
	return pos;
}

// ---------- fake Turns: two Subgraphs to animate a Delta between ----------

function expand(g: Graph, seeds: number[], hops: number): Subgraph {
	const nodes = new Set(seeds);
	const edges = new Set<number>();
	let frontier = new Set(seeds);
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
	nodes.add(0); // Person always present
	return { name: '', seeds: new Set(seeds), nodes, edges };
}

export function makeTurns(g: Graph): Subgraph[] {
	const byTitle = new Map(g.nodes.map((n, i) => [n.title, i]));
	const a = expand(g, ['Effect', 'TypeScript', 'Streaming Ingestion'].map((t) => byTitle.get(t)!), 1);
	a.name = 'Turn 1: "Tell me about your Effect work"';
	const b = expand(g, ['Kubernetes', 'Kafka', 'Leadership', 'Staff Engineer'].map((t) => byTitle.get(t)!), 1);
	b.name = 'Turn 2: job description match (K8s, Kafka, lead)';
	const c = expand(g, [byTitle.get('MSc Computer Science')!], 1);
	c.name = 'Turn 3: "Where did you study?"';
	return [a, b, c];
}

// ---------- answer-time relayout: pull the Subgraph together and recentre on it ----------
// strength 0 = static layout; 0.45 = mild; 0.75 = strong.
export function relayout(base: Float32Array, sg: Subgraph | null, strength: number): Float32Array {
	if (!sg || strength <= 0) return base;
	const out = new Float32Array(base);
	const n = base.length / 3;
	let cx = 0, cy = 0, cz = 0, k = 0;
	for (const i of sg.nodes) { cx += base[i * 3]; cy += base[i * 3 + 1]; cz += base[i * 3 + 2]; k++; }
	if (!k) return base;
	cx /= k; cy /= k; cz /= k;
	for (let i = 0; i < n; i++) {
		const inSg = sg.nodes.has(i);
		const seed = sg.seeds.has(i);
		// pull cited nodes toward their centroid, push the rest gently outward
		const f = seed ? 1 - strength * 0.75 : inSg ? 1 - strength * 0.5 : 1 + strength * 0.35;
		out[i * 3] = cx + (base[i * 3] - cx) * f - cx;
		out[i * 3 + 1] = cy + (base[i * 3 + 1] - cy) * f - cy;
		out[i * 3 + 2] = cz + (base[i * 3 + 2] - cz) * f - cz;
	}
	return out;
}
