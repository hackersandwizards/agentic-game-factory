import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { changedSteps } from "./changed.mjs";
import { withCheckLock } from "./locks.mjs";
import { checkoutFiles, git, parallelTasks, run, task } from "./process.mjs";

const [command, ...args] = process.argv.slice(2);
/** @param {...string} args */
const bun = (...args) => run("bun", ["--no-env-file", ...args]);

switch (command) {
  case "install":
    await withCheckLock(() =>
      run("bun", ["--no-env-file", "install", "--frozen-lockfile"], { timeout: 60_000 }),
    );
    break;
  case "build":
    await withCheckLock(() => bun("--bun", "vite", "build", ...args));
    break;
  case "mutation": {
    const result = spawnSync("stryker", ["run", ...args], { timeout: 900_000, stdio: "inherit" });
    if (result.error && "code" in result.error && result.error.code === "ETIMEDOUT")
      throw new Error("Mutation testing reached its 15-minute limit.");
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
    break;
  }
  case "explore": {
    if (process.env.CI !== undefined || process.env.GIT_INDEX_FILE !== undefined) {
      throw new Error("Run exploration outside CI and Git hooks.");
    }
    const seed = args.length ? Number(args[1]) : randomBytes(4).readInt32LE();
    if (
      args.length &&
      (args.length !== 2 || args[0] !== "--seed" || !/^-?\d+$/.test(args[1]) || seed !== (seed | 0))
    ) {
      throw new Error("Usage: bun run explore [--seed <signed-32-bit integer>]");
    }
    console.log(`[explore] seed ${seed}, 512 runs per property`);
    const result = spawnSync("bun", ["--no-env-file", "run", "test"], {
      timeout: 120_000,
      stdio: "inherit",
      env: { ...process.env, GAME_EXPLORE_SEED: String(seed), STRYKER_MUTATOR_WORKER: undefined },
    });
    if (result.error && "code" in result.error && result.error.code === "ETIMEDOUT")
      throw new Error("Exploration reached its two-minute limit.");
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
    break;
  }
  case "check": {
    delete process.env.GAME_EXPLORE_SEED;
    const changed = args[0] === "--changed";
    const ranges = args.slice(1);
    const oid = "(?:[a-f0-9]{40}|[a-f0-9]{64})";
    const rangePattern = new RegExp(`^${oid}\\.\\.${oid}$`);
    if (args.length && (!changed || !ranges.length || ranges.some((range) => !rangePattern.test(range)))) {
      throw new Error("Usage: bun run check [--changed <remote-oid>..<local-oid> ...]");
    }
    const selected = changed ? changedSteps(ranges) : undefined;
    /** @param {string} name */
    const enabled = (name) => {
      if (!selected || selected.has(name)) return true;
      console.log(`skipped ${name}: no changed path maps to it`);
      return false;
    };
    await withCheckLock(async () => {
      task("Frozen install", () => bun("install", "--frozen-lockfile", "--ignore-scripts"));
      const files = checkoutFiles().filter((file) => existsSync(file));
      if (changed && git(["status", "--porcelain", "--untracked-files=no"])) {
        console.log(
          "[check] Uncommitted changes: the push checks read the working tree, not the commits being pushed.",
        );
      }
      /** @type {[string, string[]][]} */
      const group = [
        ["Formatting and structure", ["scripts/source.mjs", "--files", ...files]],
        ["Source links", ["scripts/links.mjs"]],
      ];
      /** @param {string} name @param {...string} args */
      const addStep = (name, ...args) => {
        if (enabled(name)) group.push([name, args]);
      };
      addStep("Lint, styles and imports", "scripts/source.mjs", "--code", ...files);
      addStep("Linter overlap", "scripts/source.mjs", "--overlap", ...files);
      addStep("TypeScript", "--bun", "tsc");
      addStep("Dependencies and licences", "run", "check:dependencies");
      addStep("Unit tests", "run", "test");
      if (changed) addStep("Build", "--bun", "vite", "build");
      if (
        !(await parallelTasks(
          "bun",
          group.map(([label, args]) => [label, ["--no-env-file", ...args]]),
        ))
      ) {
        process.exitCode = 1;
        return;
      }
      if (!changed) task("Build", () => bun("--bun", "vite", "build"));
      if (enabled("Links in the build"))
        task("Links in the build", () => bun("scripts/links.mjs", "--build"));
      if (changed) console.log("skipped Browser tests: run the full check to play the game in Chrome");
      else task("Browser tests", () => bun("run", "test:e2e"));
    });
    break;
  }
  case "dependencies":
    (await import("./dependencies.mjs")).checkLicenses();
    break;
  case "lint":
    (await import("./source.mjs")).lint(
      checkoutFiles().filter((file) => existsSync(file)),
      false,
    );
    break;
  default:
    throw new Error(`Unknown gate command: ${String(command)}`);
}
