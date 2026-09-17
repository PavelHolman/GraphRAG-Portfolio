import { Effect, FileSystem, Schema } from 'effect';
import { join } from 'node:path';
import { HintsArtifact, decodeArtifact } from '@graphrag/schema';
import { makeGraphIndex } from '@graphrag/retrieval';
import { GENERATED_FILES, fromLittleEndian } from './build.ts';

/** Disk adapter for the GraphArtifact service: build scripts, evals and tests. ADR 0002. */
export const loadGraphIndex = (generatedDir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const text = yield* fs.readFileString(join(generatedDir, GENERATED_FILES.graph));
    const artifact = yield* decodeArtifact(JSON.parse(text) as unknown);
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
    return yield* Schema.decodeUnknownEffect(HintsArtifact)(JSON.parse(text) as unknown);
  });
