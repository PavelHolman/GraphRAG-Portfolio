import { Effect, FileSystem, Schema } from 'effect';
import { join } from 'node:path';
import { HintsArtifact } from '@graphrag/schema';

const decodeHintsJson = Schema.decodeUnknownEffect(Schema.fromJsonString(HintsArtifact));
import { makeGraphIndex } from '@graphrag/retrieval';
import { GENERATED_FILES, decodeArtifactJson, fromLittleEndian } from './build.ts';

/** Disk adapter for the GraphArtifact service: build scripts, evals and tests. ADR 0002. */
export const loadGraphIndex = (generatedDir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs.readFileString(join(generatedDir, GENERATED_FILES.graph));
    // Schema decodes the JSON: a truncated or corrupt artifact fails typed instead of throwing.
    const artifact = yield* decodeArtifactJson(text);
    const nv = fromLittleEndian(
      yield* fs.readFile(join(generatedDir, GENERATED_FILES.nodeVectors)),
    );
    const ev = fromLittleEndian(
      yield* fs.readFile(join(generatedDir, GENERATED_FILES.edgeVectors)),
    );
    return makeGraphIndex(artifact, nv, ev);
  });

export const loadHints = (generatedDir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs.readFileString(join(generatedDir, GENERATED_FILES.hints));
    return yield* decodeHintsJson(text);
  });
