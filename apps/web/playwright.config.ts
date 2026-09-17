import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // Unit tests are *.test.ts and belong to `bun test`; Playwright takes only *.e2e.ts.
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'bun run preview --port 4173',
    port: 4173,
    // e2e runs against the offline layers; no Cloudflare credential is ever needed here.
    env: { GRAPHRAG_FAKE_AI: '1' },
    reuseExistingServer: !process.env.CI,
  },
});
