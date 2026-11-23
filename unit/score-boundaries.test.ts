import { expect, test } from "vitest";
import { rankTips } from "../examples/present/domain/score";

test("recommends missing crystals and the gold time when they are the largest available awards", () => {
  const run = { crystals: 8, totalCrystals: 21, secret: true, longestChain: 0, score: 1800, hits: 0 };
  expect(rankTips(run, false)).toEqual({ rank: "B", minimum: 2500, tips: ["crystals", "speed"] });
});

test("offers just the chain tip when every other award has been earned", () => {
  const run = { crystals: 21, totalCrystals: 21, secret: true, longestChain: 0, score: 4100, hits: 0 };
  expect(rankTips(run, true)).toEqual({ rank: "S", minimum: 4600, tips: ["chains"] });
});
