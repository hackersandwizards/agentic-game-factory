import { fc, test } from "@fast-check/vitest";
import { expect } from "vitest";

test.prop([fc.constant(undefined)])("configures properties that do not import a shared generator", () => {
  const exploreSeed = process.env.GAME_EXPLORE_SEED;
  const config = fc.readConfigureGlobal();
  if (process.env.STRYKER_MUTATOR_WORKER !== undefined) {
    expect(config).toMatchObject({ seed: 17401, numRuns: 12 });
  } else if (exploreSeed !== undefined) {
    expect(config).toMatchObject({ seed: Number(exploreSeed), numRuns: 512 });
  } else {
    expect(config).toMatchObject({ seed: 17401, numRuns: 64 });
  }
});
