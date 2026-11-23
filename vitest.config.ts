import { defineConfig } from "vitest/config";

const exploring =
  process.env.GAME_EXPLORE_SEED !== undefined && process.env.STRYKER_MUTATOR_WORKER === undefined;
const timeout = exploring ? 40_000 : 5000;

export default defineConfig({
  test: {
    allowOnly: false,
    include: [`{unit,examples}/**/*.${exploring ? "prop.test" : "test"}.{ts,mjs}`],
    setupFiles: ["./unit/property-setup.ts"],
    testTimeout: timeout,
    hookTimeout: timeout,
    coverage: {
      provider: "v8",
      include: [
        "examples/present/domain/**/*.ts",
        "examples/present/ui/placement.ts",
        "scripts/changed.mjs",
        "scripts/dependencies.mjs",
        "scripts/locks.mjs",
      ],
      reporter: ["text", "html"],
    },
  },
});
