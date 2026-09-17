import { dev } from '$app/environment';
import { Effect, Layer } from 'effect';
import { EmbedError, Embedder, LanguageModel } from '@graphrag/retrieval';
import {
  LOCAL_HASHING_MODEL,
  LocalHashingEmbedderLayer,
  OpenAiCompatLanguageModelLayer,
  ScriptedLanguageModelLayer,
  WORKERS_AI_EMBEDDING_MODEL,
  WorkersAiBindingEmbedderLayer,
  WorkersAiRestEmbedderLayer,
  workersAiBaseUrl,
} from '@graphrag/retrieval/adapters';
import { artifact } from './artifact.ts';

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/**
 * Picks the Embedder and LanguageModel for this request from the platform bindings and secrets.
 * The Embedder must match the model that built the committed artifact.
 */
export const runtimeLayer = (platformEnv: App.Platform['env'] | undefined) =>
  Effect.gen(function* () {
    // In dev the platform proxy has no secrets and its AI binding is a stub that cannot serve
    // requests, so the process environment (.env at the repo root) supplies the REST credentials.
    const proc = typeof process !== 'undefined' ? process.env : undefined;
    const env: NonNullable<App.Platform['env']> = { ...platformEnv };
    if (dev && proc) {
      delete env.AI;
      if (proc.WORKERS_AI_TOKEN) env.WORKERS_AI_TOKEN = proc.WORKERS_AI_TOKEN;
      if (proc.CLOUDFLARE_ACCOUNT_ID) env.CLOUDFLARE_ACCOUNT_ID = proc.CLOUDFLARE_ACCOUNT_ID;
      if (proc.LLM_MODEL) env.LLM_MODEL = proc.LLM_MODEL;
    }
    // GRAPHRAG_FAKE_AI=1 (e2e, preview without credentials) forces the offline layers regardless
    // of which bindings the platform exposes; a local AI binding stub cannot serve requests.
    const fake =
      env?.GRAPHRAG_FAKE_AI === '1' ||
      (typeof process !== 'undefined' && process.env?.GRAPHRAG_FAKE_AI === '1');
    if (fake) {
      yield* Effect.logWarning(
        'GRAPHRAG_FAKE_AI=1: using the local hashing embedder and the scripted LanguageModel',
      );
      return Layer.merge(LocalHashingEmbedderLayer, ScriptedLanguageModelLayer);
    }
    const model = artifact.meta.embedding.model;
    let embedder: Layer.Layer<Embedder>;
    if (model === LOCAL_HASHING_MODEL) {
      embedder = LocalHashingEmbedderLayer;
    } else if (model === WORKERS_AI_EMBEDDING_MODEL && env?.AI) {
      embedder = WorkersAiBindingEmbedderLayer(env.AI);
    } else if (
      model === WORKERS_AI_EMBEDDING_MODEL &&
      env?.WORKERS_AI_TOKEN &&
      env.CLOUDFLARE_ACCOUNT_ID
    ) {
      embedder = WorkersAiRestEmbedderLayer({
        accountId: env.CLOUDFLARE_ACCOUNT_ID,
        token: env.WORKERS_AI_TOKEN,
      });
    } else {
      // Never mix models between sides (ADR 0004): query vectors from another embedder would make
      // every cosine score meaningless. Refuse the Turn with a visible error instead.
      const message = `no Embedder available for the artifact's model ${model}: bind AI or set WORKERS_AI_TOKEN and CLOUDFLARE_ACCOUNT_ID`;
      yield* Effect.logError(message);
      embedder = Layer.succeed(Embedder, {
        model,
        dimensions: artifact.meta.embedding.dimensions,
        embed: () => Effect.fail(new EmbedError({ message, retryable: false })),
      });
    }

    let languageModel: Layer.Layer<LanguageModel>;
    if (env?.WORKERS_AI_TOKEN && env.CLOUDFLARE_ACCOUNT_ID) {
      languageModel = OpenAiCompatLanguageModelLayer({
        baseUrl: workersAiBaseUrl(env.CLOUDFLARE_ACCOUNT_ID),
        apiKey: env.WORKERS_AI_TOKEN,
        model: env.LLM_MODEL ?? DEFAULT_MODEL,
      });
    } else {
      yield* Effect.logWarning(
        'WORKERS_AI_TOKEN / CLOUDFLARE_ACCOUNT_ID not set; using the scripted LanguageModel',
      );
      languageModel = ScriptedLanguageModelLayer;
    }
    return Layer.merge(embedder, languageModel);
  });
