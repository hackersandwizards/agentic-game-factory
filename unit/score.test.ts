import { expect, test } from "vitest";
import { awardTotal, recordImprovements, rankTips, winAwards } from "../examples/present/domain/score";

const run = { crystals: 3, totalCrystals: 4, secret: true, kills: 2, longestChain: 2, score: 300, hits: 1 };

test("scores the win by category and adds exactly the earned points", () => {
  const awards = winAwards(run, true);
  expect(awards).toEqual([
    ["crystals", 300],
    ["secret", 1000],
    ["bugs", 300],
    ["unhurt", 0],
    ["time", 500],
  ]);
  expect(awardTotal(awards)).toBe(2100);
  expect(winAwards({ ...run, crystals: 4 }, false)).toEqual([
    ["crystals", 400],
    ["secret", 1000],
    ["bugs", 300],
    ["unhurt", 0],
    ["time", 0],
  ]);
});

test("returns the records beaten in score-then-time order", () => {
  expect(recordImprovements(29, 2501, 30, 2500)).toEqual(["score", "time"]);
  expect(recordImprovements(30, 2501, 30, 2500)).toEqual(["score"]);
  expect(recordImprovements(29, 2500, 30, 2500)).toEqual(["time"]);
  expect(recordImprovements(30, 2500, 30, 2500)).toEqual([]);
  expect(recordImprovements(0, 0, 0, 0)).toEqual(["time"]);
});

test("suggests the two biggest remaining awards in score order and stops at S", () => {
  expect(rankTips(run, true)).toEqual({ rank: "B", minimum: 2500, tips: ["unhurt", "chains"] });
  expect(rankTips({ ...run, secret: false, score: 3600 }, false)).toEqual({
    rank: "S",
    minimum: 4600,
    tips: ["secret", "unhurt"],
  });
  expect(rankTips({ ...run, score: 4600 }, false)).toBeUndefined();
});
