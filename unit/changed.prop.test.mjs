import { fc, test } from "@fast-check/vitest";
import { expect, vi } from "vitest";
import { changedSteps } from "../scripts/changed.mjs";
import { unicodeString } from "./property-setup";

const before = "a".repeat(40);
const after = "b".repeat(40);
const range = `${before}..${after}`;
const noExtraSteps = new Set();
const withSource = new Set([
  "Unit tests",
  "Lint, styles and imports",
  "Linter overlap",
  "TypeScript",
  "Build",
  "Links in the build",
]);

const pathText = unicodeString.map((text) => text.replaceAll("\0", ""));
const docs = fc
  .tuple(
    fc.oneof(
      pathText,
      pathText.map((stem) => `line\n${stem}`),
    ),
    fc.constantFrom("md", "mp4", "png", "webp"),
  )
  .map(([stem, extension]) => `docs/${stem}.${extension}`);
const source = fc
  .tuple(fc.constantFrom("src", "starter", "examples", "public", "tests", "unit"), pathText)
  .map(([root, stem]) => `${root}/${stem}.ts`);

test.prop([fc.array(docs), fc.array(source)], {
  examples: [
    [[], []],
    [["docs/a.png", "docs/b.webp", "docs/c.mp4", "README.md", "src/readme.md"], []],
    [
      ["docs/📁/日本語.md", `docs/${"a".repeat(1024)}.png`],
      ["src/a.ts", "examples/b.ts", "public/c.ts", "tests/d.ts", "unit/e.ts", "index.html", "brand.json"],
    ],
    [[], ["src/tutorial.md.ts", "src/tab\tand\nnewline.ts"]],
  ],
})("unions the checks for NUL-delimited paths across Git ranges", (documents, sources) => {
  const ranges = [range, `${after}..${before}`];
  /** @param {string[]} args */
  const readGit = (args) => `\0${(args[4] === after ? sources : documents).join("\0")}\0`;
  expect(changedSteps(ranges, readGit)).toEqual(sources.length ? withSource : noExtraSteps);
});

test.prop(
  [
    fc.array(
      pathText.map((stem) => `misc/${stem}.unknown`),
      { minLength: 1 },
    ),
  ],
  {
    examples: [
      [
        [
          "misc/.unknown",
          "constructor",
          "__proto__",
          "toString",
          "package.json",
          "bun.lock",
          "tsconfig.json",
          "misc/docs/title.png",
          "docs/title.png.old",
          "studio/src/trailer.ts",
          "studio/index.html",
          "index.html.old",
          "studio/brand.json",
          "brand.json.old",
          "é/日本語",
          "misc/notes.md.old",
          "otherbrand.json",
          "brand.json-backup",
        ],
      ],
    ],
  },
)("falls back to all push checks when any path is unmapped", (unmapped) => {
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  try {
    for (const path of unmapped) {
      expect(changedSteps([range], () => `src/main.ts\0${path}\0docs/notes.md\0`)).toBeUndefined();
    }
  } finally {
    log.mockRestore();
  }
});
