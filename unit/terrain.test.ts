import { expect, test } from "vitest";
import { Terrain } from "../examples/present/domain/terrain";

const fall = { gravity: 3600, maxFall: 600 };

test("checks four corners and ignores plank bridges for ceilings", () => {
  const ground = new Terrain(["=c", "#."], fall);
  expect(ground.solidAt(0, 0, 48, 48)).toBe(true);
  expect(ground.ceilingAt(0, 0, 48, 48)).toBe(false);
  expect(ground.ceilingAt(0, 0, 49, 48)).toBe(true);
  expect(ground.solidAt(48, 48, 48, 48)).toBe(false);
});

test("searches four rows for ground and treats the current row as already blocked", () => {
  const ground = new Terrain(["..", "..", "..", "=.", ".#"], fall);
  expect(ground.groundBelow(0, 0)).toBe(148);
  expect(ground.groundBelow(48, 0)).toBe(-1);
  expect(ground.groundBelow(0, 144)).toBe(-1);
});

test("predicts the first landing along the fall's arc using its supplied feel", () => {
  const rows = ["..", "..", ".="];
  expect(new Terrain(rows, fall).landing(0, 0, 240, 0)).toBe(100);
  expect(new Terrain(rows, fall).landing(0, 0, 0, 0)).toBe(-1);
  expect(new Terrain(rows, { ...fall, maxFall: 0 }).landing(0, 0, 240, 0)).toBe(-1);
});

test("finds the first gap on the bottom row and permits a level with none", () => {
  expect(new Terrain(["#.", "##.#"], fall).firstPit()).toBe(96);
  expect(new Terrain(["#.", "####"], fall).firstPit()).toBe(Infinity);
});
