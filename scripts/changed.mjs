import { git, paths } from "./process.mjs";

/** @type {[RegExp, string[]][]} */
const pathSteps = [
  [/\.md$|^docs\/.*\.(?:mp4|png|webp)$/s, []],
  [
    /^(?:src|starter|examples|public|tests|unit)\/|^index\.html$|^brand\.json$/,
    ["Lint, styles and imports", "Linter overlap", "TypeScript", "Unit tests", "Build", "Links in the build"],
  ],
];

/** @param {string[]} ranges */
export function changedSteps(ranges, readGit = git) {
  /** @param {string} reason */
  const all = (reason) => console.log(`[check] ${reason}. Running all push checks.`);
  /** @type {Set<string>} */
  const selected = new Set();
  for (const range of ranges) {
    const [from, to] = range.split("..");
    if (/^0+$/.test(from)) return all("A new branch has no previous remote tip");
    let files;
    try {
      files = paths(readGit(["diff", "--name-only", "--no-renames", "-z", from, to, "--"]));
    } catch {
      return all("Git could not list the changed paths");
    }
    for (const file of files) {
      const entry = pathSteps.find(([pattern]) => pattern.test(file));
      if (!entry) return all(`No path rule for ${file}`);
      for (const step of entry[1]) selected.add(step);
    }
  }
  return selected;
}
