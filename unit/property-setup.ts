import { fc } from "@fast-check/vitest";

const underStryker = process.env.STRYKER_MUTATOR_WORKER !== undefined;
const exploreSeed = underStryker ? undefined : process.env.GAME_EXPLORE_SEED;

fc.configureGlobal({
  seed: exploreSeed === undefined ? 17401 : Number(exploreSeed),
  numRuns: underStryker ? 12 : exploreSeed === undefined ? 64 : 512,
});

export const unicodeString = fc.string({ unit: "grapheme", maxLength: 1024, size: "max" });
