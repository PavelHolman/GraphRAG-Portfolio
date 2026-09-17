// The artifact decodes Temporal values at import time, before the server hooks run (and before
// SvelteKit's build-time analysis, which has no Temporal either).
import 'temporal-polyfill/global';
import { dev } from '$app/environment';
import { Effect } from 'effect';
import { GraphArtifact as ArtifactSchema, type GraphArtifact } from '@graphrag/schema';
import { Schema } from 'effect';
import { makeGraphIndex, type GraphIndex } from '@graphrag/retrieval';
import graphJson from '@graphrag/graph-index/generated/graph.json';
import hintsJson from '@graphrag/graph-index/generated/hints.json';
import nodeVectorsUrl from '@graphrag/graph-index/generated/node-embeddings.bin?url';
import edgeVectorsUrl from '@graphrag/graph-index/generated/edge-embeddings.bin?url';
import type { RequestEvent } from '@sveltejs/kit';

/** The committed artifact, decoded once per isolate. ADR 0002: static import at runtime. */
export const artifact: GraphArtifact = Schema.decodeUnknownSync(ArtifactSchema)(graphJson);
export const hints = hintsJson as ReadonlyArray<{
  id: string;
  prompt: string;
  candidateIds: ReadonlyArray<string>;
}>;

const readFloat32 = (buf: ArrayBuffer): Float32Array => {
  const view = new DataView(buf);
  const out = new Float32Array(buf.byteLength / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
};

let cached: Promise<GraphIndex> | undefined;

/** Vectors ship as static assets next to the Worker; fetched once and kept for the isolate's life. */
export const loadGraphIndex = (event: RequestEvent): Effect.Effect<GraphIndex> =>
  Effect.promise(() => {
    cached ??= (async () => {
      const fetchAsset = async (url: string) => {
        // Dev: Vite serves the `?url` asset from disk as /@fs/<path>; read that path directly.
        // This branch is compiled away in the Workers build (`dev` is a build-time constant).
        if (dev && url.startsWith('/@fs/')) {
          const { readFile } = await import('node:fs/promises');
          const buf = await readFile(decodeURIComponent(url.slice('/@fs'.length)));
          return readFloat32(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
        }
        const abs = new URL(url, event.url.origin);
        const assets = event.platform?.env?.ASSETS;
        // Workers: the ASSETS binding. Dev and preview: a real HTTP fetch, because the `?url` asset
        // is served by Vite's middleware, which SvelteKit's internal fetch never reaches.
        const res = assets ? await assets.fetch(new Request(abs)) : await fetch(abs);
        // A non-OK body must never be decoded as vectors and cached for the isolate's lifetime.
        if (!res.ok)
          return Promise.reject(new Error(`vector asset ${abs.pathname} answered ${res.status}`));
        return readFloat32(await res.arrayBuffer());
      };
      const [nv, ev] = await Promise.all([fetchAsset(nodeVectorsUrl), fetchAsset(edgeVectorsUrl)]);
      return makeGraphIndex(artifact, nv, ev);
    })().catch((err: unknown) => {
      // Do not poison the isolate: the next request retries the fetch.
      cached = undefined;
      return Promise.reject(err);
    });
    return cached;
  });
