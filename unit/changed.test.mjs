import { expect, test, vi } from "vitest";
import { changedSteps } from "../scripts/changed.mjs";

const before = "a".repeat(40);
const after = "b".repeat(40);
const range = `${before}..${after}`;

test("a new branch selects every push step without asking Git for a diff", () => {
  const readGit = vi.fn(() => "README.md\0");
  expect(changedSteps([`${"0".repeat(40)}..${after}`], readGit)).toBeUndefined();
  expect(readGit).not.toHaveBeenCalled();
});

test.each([`0${before.slice(1)}`, `${before.slice(1)}0`])("a real tip can contain zeroes (%s)", (tip) => {
  expect(changedSteps([`${tip}..${after}`], () => "README.md\0")).toEqual(new Set());
});

test("a source file renamed to Markdown still selects the source checks", () => {
  const steps = changedSteps([range], (args) => {
    expect(args).toEqual(["diff", "--name-only", "--no-renames", "-z", before, after, "--"]);
    return "src/main.ts\0docs/main.md\0";
  });
  expect(steps?.has("TypeScript")).toBe(true);
});

test("a Git diff error selects every push step", () => {
  const steps = changedSteps([range], () => {
    throw new Error("unknown revision");
  });
  expect(steps).toBeUndefined();
});

test("prints why it fell back to every push step", () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    changedSteps([`${"0".repeat(40)}..${after}`]);
    changedSteps([range], () => "package.json\0");
    changedSteps([range], () => {
      throw new Error("unknown revision");
    });
    expect(log.mock.calls.flat()).toEqual([
      "[check] A new branch has no previous remote tip. Running all push checks.",
      "[check] No path rule for package.json. Running all push checks.",
      "[check] Git could not list the changed paths. Running all push checks.",
    ]);
  } finally {
    log.mockRestore();
  }
});

test("handles a newline in a docs asset filename from Git", () => {
  expect(changedSteps([range], () => "docs/line\nbreak.png\0")).toEqual(new Set());
});
