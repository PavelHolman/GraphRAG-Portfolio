import type { AiBinding } from '@graphrag/retrieval/adapters';

declare global {
  namespace App {
    interface Platform {
      env?: {
        AI?: AiBinding;
        ASSETS?: { fetch: (input: Request | string | URL) => Promise<Response> };
        WORKERS_AI_TOKEN?: string;
        CLOUDFLARE_ACCOUNT_ID?: string;
        LLM_MODEL?: string;
        DEPLOYMENT_ENVIRONMENT?: string;
      };
      context?: { waitUntil: (p: Promise<unknown>) => void };
    }
  }
}

export {};
