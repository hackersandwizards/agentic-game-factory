import { expect, test } from "vitest";
import { POINTS, RANKS } from "../examples/present/domain/score";

test("sets the point awards for the example level", () => {
  expect(POINTS).toEqual({ kill: 100, crystal: 100, secret: 1000, unhurt: 500, gold: 500 });
});

test("sets the example level's rank thresholds", () => {
  expect(RANKS).toEqual([
    ["S", 4600],
    ["A", 3500],
    ["B", 2500],
    ["C", 0],
  ]);
});
