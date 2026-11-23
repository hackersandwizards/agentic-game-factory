import { expect, test } from "vitest";
import { Terrain } from "../examples/present/domain/terrain";

const fall = { gravity: 60, maxFall: 600 };

test("finds a gap at the left edge of the bottom row", () => {
  expect(new Terrain(["###", "###", ".##"], fall).firstPit()).toBe(0);
});

test("any one of the four corners can intersect a solid tile", () => {
  for (const rows of [
    ["#.", ".."],
    [".#", ".."],
    ["..", "#."],
    ["..", ".#"],
  ]) {
    expect(new Terrain(rows, fall).solidAt(47, 47, 2, 2)).toBe(true);
  }
});

test("a rectangle beyond the level rows meets no tiles", () => {
  expect(new Terrain(["#"], fall).solidAt(0, -1, 1, 1)).toBe(false);
});

test("ground below includes crates and treats missing rows as empty", () => {
  expect(new Terrain([".", "c"], fall).groundBelow(0, 47)).toBe(48);
  expect(new Terrain(["."], fall).groundBelow(0, 0)).toBe(-1);
});

test("he has fallen out of the map a tile and a half below its bottom row", () => {
  const terrain = new Terrain([".", "."], fall);
  expect(terrain.fellOut(168)).toBe(false);
  expect(terrain.fellOut(169)).toBe(true);
});

test("predicts a landing through step 120 and stops before step 121", () => {
  const terrain = new Terrain([".", ".", "#"], { gravity: 0, maxFall: 60 });
  expect(terrain.landing(0, -24, 0, 60)).toBe(96);
  expect(terrain.landing(0, -25, 0, 60)).toBe(-1);
});

test("an arc starting at the map's bottom edge is already out of bounds", () => {
  expect(new Terrain(["#"], fall).landing(0, 48, 0, -30)).toBe(-1);
});

test("gravity advances the fall one step at a time as it drifts onto a crate", () => {
  expect(new Terrain(["..", ".c"], fall).landing(0, 0, 60, 0)).toBe(48);
});

test("a stationary body inside a tile is not landing", () => {
  expect(new Terrain(["#"], { gravity: 0, maxFall: 60 }).landing(0, 0, 0, 0)).toBe(-1);
});
