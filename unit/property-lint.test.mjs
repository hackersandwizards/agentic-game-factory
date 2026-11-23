import { ESLint } from "eslint";
import { expect, test } from "vitest";

const propertyFile = "unit/probe.prop.test.mjs";
const propertyRequired = "Write properties as test.prop([...])(name, fn).";
const sharedOptions = "Use inline property options and the shared seed and case count.";
const emptyTest = 'test("no assertion", () => {});';
const emptyTestMessage = "Write the assertion or remove the empty test.";

const invalidCases = [
  [
    propertyFile,
    'test.prop([fc.boolean()])("no matcher", (value) => expect(value));',
    "Assert the rule inside the property callback.",
  ],
  [propertyFile, 'test("ordinary test", () => expect(true).toBe(true));', propertyRequired],
  [propertyFile, 'import { it } from "@fast-check/vitest";', "Import test by name from @fast-check/vitest."],
  [propertyFile, 'import { test } from "vitest";', "Keep ordinary tests in ordinary test files."],
  [
    propertyFile,
    'test.prop([fc.boolean()], { seed: 1 })("a property", (value) => expect(value).toBe(true));',
    sharedOptions,
  ],
  [
    propertyFile,
    'test.prop([fc.boolean()], { numRuns: 1 })("a property", (value) => expect(value).toBe(true));',
    sharedOptions,
  ],
  [
    "unit/probe.test.mjs",
    'import { test } from "@fast-check/vitest";',
    "Put properties in *.prop.test.* files so exploration can run them.",
  ],
  [
    "examples/probe/probe.test.ts",
    'import { test } from "@fast-check/vitest";',
    "Put properties in *.prop.test.* files so exploration can run them.",
  ],
  [
    "examples/probe/probe.prop.test.ts",
    'test("ordinary test", () => expect(true).toBe(true));',
    propertyRequired,
  ],
  ["tests/probe.ts", emptyTest, emptyTestMessage],
  ["unit/probe.ts", emptyTest, emptyTestMessage],
  [
    "scripts/probe.test.mjs",
    "expect(Promise.resolve(true)).resolves.toBe(true);",
    "Await the operation before asserting its result or caught error.",
  ],
];

const validCases = [
  [
    propertyFile,
    'test.prop([fc.boolean()], { examples: [[true]] })("a property", (value) => expect(value).not.toBeUndefined());',
  ],
  ["unit/probe.test.mjs", "subscribe(() => {});"],
];

test("enforces property syntax and preserves the shared test restrictions", async () => {
  const linter = new ESLint();
  for (const [filePath, source, message] of invalidCases) {
    const [result] = await linter.lintText(source, { filePath });
    expect(result.messages, `${filePath} ${source}`).toEqual([
      expect.objectContaining({ ruleId: "no-restricted-syntax", message }),
    ]);
  }

  for (const [filePath, source] of validCases) {
    const [result] = await linter.lintText(source, { filePath });
    expect(result.messages, `${filePath} ${source}`).toEqual([]);
  }
});
