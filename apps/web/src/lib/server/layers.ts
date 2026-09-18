import { dev } from '$app/environment';
import { Config, ConfigProvider, Effect, Layer } from 'effect';
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

/** Only strings can come from a config source; the AI binding is an object and is read directly. */
const strings = (env: object | undefined): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env ?? {})) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
};

const optional = (name: string) => Config.withDefault(Config.String(name), '');

/**
 * Picks the Embedder and LanguageModel for this request from the platform bindings and secrets.
 * The Embedder must match the model that built the committed artifact.
 */
export const runtimeLayer = (platformEnv: App.Platform['env'] | undefined) => {
  // In dev the platform proxy has no secrets and its AI binding is a stub that cannot serve
  // requests, so the process environment (`.env` at the repo root) wins and the binding is dropped.
  const processEnv = dev && typeof process !== 'undefined' ? process.env : undefined;
  const provider = ConfigProvider.fromEnvRecord({
    ...strings(platformEnv),
    ...strings(processEnv),
  });
  const ai = dev ? undefined : platformEnv?.AI;
  return pick(ai).pipe(Effect.provide(ConfigProvider.layer(provider)));
};

const pick = (ai: NonNullable<App.Platform['env']>['AI'] | undefined) =>
  Effect.gen(function* () {
    const token = yield* optional('WORKERS_AI_TOKEN');
    const accountId = yield* optional('CLOUDFLARE_ACCOUNT_ID');
    const llmModel = yield* optional('LLM_MODEL');
    // GRAPHRAG_FAKE_AI=1 (e2e, preview without credentials) forces the offline layers regardless
    // of which bindings the platform exposes; a local AI binding stub cannot serve requests.
    if ((yield* optional('GRAPHRAG_FAKE_AI')) === '1') {
      yield* Effect.logWarning(
        'GRAPHRAG_FAKE_AI=1: using the local hashing embedder and the scripted LanguageModel',
      );
      return Layer.merge(LocalHashingEmbedderLayer, ScriptedLanguageModelLayer);
    }
    const model = artifact.meta.embedding.model;
    let embedder: Layer.Layer<Embedder>;
    if (model === LOCAL_HASHING_MODEL) {
      embedder = LocalHashingEmbedderLayer;
    } else if (model === WORKERS_AI_EMBEDDING_MODEL && ai) {
      embedder = WorkersAiBindingEmbedderLayer(ai);
    } else if (model === WORKERS_AI_EMBEDDING_MODEL && token && accountId) {
      embedder = WorkersAiRestEmbedderLayer({ accountId, token });
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
    if (token && accountId) {
      languageModel = OpenAiCompatLanguageModelLayer({
        baseUrl: workersAiBaseUrl(accountId),
        apiKey: token,
        model: llmModel || DEFAULT_MODEL,
      });
    } else {
      yield* Effect.logWarning(
        'WORKERS_AI_TOKEN / CLOUDFLARE_ACCOUNT_ID not set; using the scripted LanguageModel',
      );
      languageModel = ScriptedLanguageModelLayer;
    }
    return Layer.merge(embedder, languageModel);
  });
