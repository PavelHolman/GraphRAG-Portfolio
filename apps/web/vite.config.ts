import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  assetsInclude: ['**/*.bin'],
  ssr: { noExternal: ['@graphrag/schema', '@graphrag/retrieval', '@graphrag/graph-index'] },
});
