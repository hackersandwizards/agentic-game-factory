import { expect, test } from "vitest";
import { checkMap, isSolid, readMap } from "../examples/present/domain/map";

test("reads every map character as its cell", () => {
  expect(readMap([".#=c", "o*vd", "bfhT", "DLjt", "g4n"])).toEqual([
    ["air", "ground", "plank", "crate"],
    ["crystal", "secret", "heart", "die"],
    ["bug", "fast", "hop", "tree"],
    ["door", "goal", "cane", "terminal"],
    ["ghost", "sign", "neon"],
  ]);
});

test("names the place of a character the legend lacks", () => {
  expect(() => readMap(["..", ".?"])).toThrow('Map row 2, column 2: "?" is no map character.');
});

test("ground and crates are solid, a plank is solid but no ceiling, nothing else is", () => {
  expect(isSolid("ground")).toBe(true);
  expect(isSolid("crate")).toBe(true);
  expect(isSolid("plank")).toBe(true);
  expect(isSolid("ground", true)).toBe(true);
  expect(isSolid("crate", true)).toBe(true);
  expect(isSolid("plank", true)).toBe(false);
  expect(isSolid("air")).toBe(false);
  expect(isSolid("tree")).toBe(false);
  expect(isSolid(undefined)).toBe(false);
});

test("a map with a door, a goal and rows of one length can be played", () => {
  expect(() => checkMap(readMap(["D.L", "###"]))).not.toThrow();
});

test("a map without a door or without a goal cannot be played", () => {
  expect(() => checkMap(readMap(["..L", "###"]))).toThrow("The map has no door (D).");
  expect(() => checkMap(readMap(["D..", "###"]))).toThrow("The map has no goal (L).");
  expect(() => checkMap([])).toThrow("The map has no door (D).");
});

test("a map with rows of different lengths names the first that differs", () => {
  expect(() => checkMap(readMap(["D.L", "###", "##", "#"]))).toThrow(
    "Map row 3 is 2 characters long, row 1 is 3.",
  );
});
