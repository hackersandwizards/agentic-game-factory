import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { delimiter, resolve } from "node:path";
import { git, paths, run, task } from "./process.mjs";

const diff = ["diff", "--cached", "--name-only", "--no-renames", "-z"];
const staged = paths(git([...diff, "--diff-filter=ACMR"]));
if (!staged.length && !git(diff)) process.exit(0);
const files = paths(git(["ls-files", "-z", "--cached"]));
const root = process.cwd();

/** @param {string} name */
function skip(name) {
  console.log(`skipped ${name}: runs at push and in the full check when applicable`);
}

mkdirSync("node_modules/.cache", { recursive: true });
const snapshot = mkdtempSync(resolve("node_modules/.cache/staged-"));
try {
  git(["checkout-index", "--all", "--prefix", snapshot + "/"]);
  process.chdir(snapshot);
  const source = /** @type {typeof import("./source.mjs")} */ (await import(resolve("scripts/source.mjs")));
  const dependencies = /** @type {typeof import("./dependencies.mjs")} */ (
    await import(resolve("scripts/dependencies.mjs"))
  );
  const checkDependencies = staged.some((file) =>
    ["package.json", "studio/package.json", "bun.lock", "studio/bun.lock", "bunfig.toml"].includes(file),
  );
  source.checkStructure(files);
  source.checkPublicFiles(staged);
  // Frozen install can fail on an unpinned manifest before Bun reports which pin is invalid.
  if (checkDependencies) {
    dependencies.checkPins("package.json");
    dependencies.checkPins("studio/package.json");
  } else skip("Dependency pins");

  run("bun", ["install", "--frozen-lockfile", "--ignore-scripts", "--prefer-offline"], { timeout: 60_000 });
  process.env.PATH = `${resolve("node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`;
  task("Staged files", () => {
    if (staged.some((file) => source.format.test(file))) source.checkFormatting(staged);
    else skip("Prettier");
    if (staged.some((file) => source.code.test(file))) source.lint(staged, true);
    else {
      skip("Oxlint");
      skip("ESLint");
    }
    if (staged.some((file) => source.styles.test(file))) source.checkStyles(staged);
    else skip("Stylelint");
  });
  if (staged.some((file) => file === ".oxlintrc.json" || file === "eslint.config.js")) {
    await source.checkOverlap(files);
  } else skip("Linter overlap");
  if (checkDependencies) dependencies.checkLicenses();
  else skip("Dependency licences");
  skip("Dependency Cruiser");
  run("bun", ["scripts/links.mjs", "--files", ...files.filter((file) => file.endsWith(".md"))]);
} finally {
  process.chdir(root);
  rmSync(snapshot, { recursive: true, force: true });
}
