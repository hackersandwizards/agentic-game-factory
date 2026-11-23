import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { checkPins } from "./dependencies.mjs";
import { output, run } from "./process.mjs";

export const code = /\.[cm]?[jt]sx?$/;
const ts = /\.[cm]?tsx?$/;
export const format = /\.(?:[cm]?[jt]sx?|css|html|jsonc?|md|ya?ml)$/;
export const styles = /\.(css|html)$/;
const structure = [
  "bun.lock",
  "bunfig.toml",
  "package.json",
  "studio/package.json",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.config.ts",
  ".oxlintrc.json",
  "eslint.config.js",
  "stylelint.config.mjs",
  ".dependency-cruiser.cjs",
  "scripts/tasks.mjs",
  "scripts/staged.mjs",
  ".githooks/pre-commit",
  ".githooks/pre-push",
  ".githooks/post-checkout",
  ".githooks/post-merge",
];

/** @param {string[]} files */
export function checkStructure(files) {
  for (const file of structure) {
    if (!files.includes(file)) throw new Error(`Required by the game gate: ${file}`);
    if (file.startsWith(".githooks/") && process.platform !== "win32" && !(statSync(file).mode & 0o111)) {
      throw new Error(`Make ${file} executable before committing it.`);
    }
  }
  JSON.parse(readFileSync("brand.json", "utf8"), (key, value) => {
    if (
      key === "colors" &&
      !Object.values(value).every((color) => typeof color === "string" && /^#[\da-f]{6}$/i.test(color))
    ) {
      throw new Error("brand.json colours must be six-digit hex values.");
    }
    return value;
  });
}

/** @param {unknown} value */
function enabled(value) {
  return ![undefined, "off", "allow", 0].includes(Array.isArray(value) ? value[0] : value);
}

/** @param {string[]} globs @param {string} file */
function applies(globs, file) {
  return globs.some((glob) => new Bun.Glob(glob).match(file));
}

/** @param {string[]} files */
export async function checkOverlap(files) {
  const sources = files.filter((file) => code.test(file));
  if (!sources.length) return;
  /** @type {{rules: Record<string, unknown>, overrides?: {files: string[], rules: Record<string, unknown>}[]}} */
  const ox = JSON.parse(
    output("oxlint", ["--no-ignore", "--disable-nested-config", "--print-config", "--", sources[0]]),
  );
  const { ESLint } = await import("eslint");
  const eslint = new ESLint({ ignore: false });
  for (const file of sources) {
    const js = await eslint.calculateConfigForFile(file);
    if (!js) throw new Error(`ESLint does not select ${file}.`);
    const rules = { ...ox.rules };
    for (const override of ox.overrides ?? []) {
      if (applies(override.files, file)) Object.assign(rules, override.rules);
    }
    for (const [rule, value] of Object.entries(js.rules ?? {})) {
      const mapped = rule.replace(/^@typescript-eslint\//, "typescript/");
      const equivalent = mapped.replace(
        /^typescript\/(no-(?:array-constructor|unused-vars|unused-expressions))$/,
        "$1",
      );
      if (enabled(value) && (enabled(rules[mapped]) || enabled(rules[equivalent]))) {
        throw new Error(`${file}: ${rule} is enabled in both linters.`);
      }
    }
  }
}

/** @param {string[]} files */
function checkProjects(files) {
  const project = new Set(
    output("tsc", ["--listFilesOnly"], { maxBuffer: 10 * 1024 * 1024 })
      .trim()
      .split(/\r?\n/)
      .map((file) => resolve(file)),
  );
  for (const file of files.filter((file) => ts.test(file) || /^(scripts|unit)\/.*\.mjs$/s.test(file))) {
    if (!project.has(resolve(file))) throw new Error(`${file} is outside tsconfig.json.`);
  }
}

/** @param {string[]} files */
export function checkPublicFiles(files) {
  const credentials = [
    /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
    /\bgithub_pat_[A-Za-z0-9_]{50,}\b/,
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
    /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/,
  ];
  for (const file of files) {
    if (/(^|\/)\.env(?:\.|$)/.test(file)) throw new Error(`Keep environment files out of Git: ${file}`);
    if (!/\.(?:[cm]?[jt]sx?|md|html|jsonc?|ya?ml|toml|sh|txt)$/.test(file)) continue;
    const content = readFileSync(file, "utf8");
    if (credentials.some((pattern) => pattern.test(content)))
      throw new Error(`Possible credential in ${file}`);
  }
}

/** @param {string[]} files @param {boolean} staged */
export function lint(files, staged) {
  const sources = files.filter((file) => code.test(file));
  if (!sources.length) return;
  if (!staged) checkProjects(sources);
  run("oxlint", [
    "--no-ignore",
    "--disable-nested-config",
    "--deny-warnings",
    ...(staged ? [] : ["--type-aware"]),
    "--",
    ...sources,
  ]);
  run("eslint", ["--no-ignore", "--max-warnings", "0", "--", ...sources]);
}

/** @param {string[]} files */
export function checkFormatting(files) {
  const formatted = files.filter((file) => format.test(file));
  if (formatted.length) run("prettier", ["--check", "--", ...formatted]);
}

/** @param {string[]} files */
export function checkStyles(files) {
  const styled = files.filter((file) => styles.test(file));
  if (styled.length) run("stylelint", ["--max-warnings", "0", "--", ...styled]);
}

/** @param {string[]} files */
function checkFiles(files) {
  checkStructure(files);
  checkPins("package.json");
  checkPins("studio/package.json");
  checkPublicFiles(files);
  checkFormatting(files);
}

/** @param {string[]} files */
function checkCode(files) {
  lint(files, false);
  checkStyles(files);
  run("dependency-cruise", [
    "--config",
    ".dependency-cruiser.cjs",
    "--",
    ...files.filter((file) => code.test(file)),
  ]);
}

if (import.meta.main) {
  const [mode, ...files] = process.argv.slice(2);
  if (mode === "--files") checkFiles(files);
  else if (mode === "--code") checkCode(files);
  else if (mode === "--overlap") await checkOverlap(files);
  else throw new Error(`Unknown source check: ${String(mode)}`);
}
