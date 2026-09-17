import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
  },
  kit: {
    adapter: adapter({
      config: 'wrangler.jsonc',
      // The AI binding is remote-only; without a Cloudflare token local dev falls back to the
      // scripted LanguageModel and the artifact's embedder instead of opening a remote proxy session.
      platformProxy: { remoteBindings: Boolean(process.env.CLOUDFLARE_API_TOKEN) },
    }),
    csrf: { trustedOrigins: [] },
  },
};

export default config;
