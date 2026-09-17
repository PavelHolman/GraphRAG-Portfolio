import { Effect, Layer } from 'effect';
import { Embedder, LanguageModel } from '@graphrag/retrieval';
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
export const runtimeLayer = (env: App.Platform['env'] | undefined) =>
  Effect.gen(function* () {
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
      yield* Effect.logWarning(
        `no Embedder available for artifact model ${model}; falling back to the local hashing embedder`,
      );
      embedder = LocalHashingEmbedderLayer;
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
