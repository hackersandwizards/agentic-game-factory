import { existsSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { run } from "./process.mjs";

if (existsSync(".git")) {
  const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (root.status !== 0 || realpathSync(root.stdout.trim()) !== realpathSync(process.cwd())) {
    throw new Error("Run bun install from the root of the game checkout to install its Git hooks.");
  }
  run("git", ["config", "--local", "core.hooksPath", ".githooks"]);
}
