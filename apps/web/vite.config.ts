import { sveltekit } from '@sveltejs/kit/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEV_KEYS = ['WORKERS_AI_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'LLM_MODEL'] as const;

export default defineConfig(({ mode }) => {
  // The dev server runs in apps/web; the repo-root .env holds the local credentials
  // (`.env.example`). Only the server-side layer reads these; nothing reaches the client bundle.
  const env = loadEnv(mode, ROOT, '');
  for (const k of DEV_KEYS) if (env[k] && !process.env[k]) process.env[k] = env[k];
  return {
    plugins: [sveltekit()],
    assetsInclude: ['**/*.bin'],
    ssr: { noExternal: ['@graphrag/schema', '@graphrag/retrieval', '@graphrag/graph-index'] },
  };
});
