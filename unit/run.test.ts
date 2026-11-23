import { expect, test } from "vitest";
import { chainPoints, INVULNERABLE_MS, LIVES, STOMP_GRACE_MS } from "../examples/present/domain/combat";
import { Run } from "../examples/present/domain/run";
import type { RunEvents } from "../examples/present/domain/run";
import { awardTotal, GOLD_TIME, winAwards } from "../examples/present/domain/score";

type Parts = { pickup: string; bug: string; checkpoint: string };
type Events = RunEvents<Parts>;
type Seen = { [Type in keyof Events]: [Type, Events[Type]] }[keyof Events];

const TYPES = ["collected", "healed", "squished", "hurt", "checkpoint", "gameOver", "won"] as const;
const GOAL = 2000;
// The run is won 112 px before the goal.
const LINE = GOAL - 112;

function watched(crystals = 5, checkpoints = 2) {
  const run = new Run<Parts>({ start: { x: 10, y: 20 }, crystals, checkpoints, goal: GOAL });
  const seen: Seen[] = [];
  for (const type of TYPES) run.on(type, (event) => seen.push([type, event] as Seen));
  return { run, seen };
}

const moving = (y: number, speed: number, x = 0) => ({
  prev: { y },
  height: 10,
  velocity: { y: speed },
  center: { x },
});
// He falls onto the bug from above: a stomp. Beside it, level with it: no stomp.
const above = (x = 0) => moving(0, 50, x);
const beside = (x = 0) => moving(15, 0, x);
// Bounced off a bug he rises above the next one: a stomp only within the grace.
const rising = () => moving(0, -50);
const bug = (x = 0) => moving(20, 0, x);

test("starts full, unscored and at the level's start, announcing nothing", () => {
  const start = { x: 10, y: 20 };
  const run = new Run<Parts>({ start, crystals: 5, checkpoints: 2, goal: GOAL });
  expect(run).toMatchObject({
    lives: LIVES,
    crystals: 0,
    secret: false,
    score: 0,
    chain: 0,
    kills: 0,
    longestChain: 0,
    hits: 0,
    won: false,
    gameOver: false,
    invulnerableUntil: 0,
    startedAt: Infinity,
    totalCrystals: 5,
    checkpoint: { x: 10, y: 20 },
  });
  start.x = 99;
  expect(run.checkpoint.x).toBe(10);
});

test("an event with no handler is dropped, and handlers run in the order they were added", () => {
  const run = new Run<Parts>({ start: { x: 0, y: 0 }, crystals: 1, checkpoints: 0, goal: GOAL });
  run.collect("first", false);
  const order: string[] = [];
  run.on("collected", ({ pickup }) => order.push(`a:${pickup}`));
  run.on("collected", ({ pickup }) => order.push(`b:${pickup}`));
  run.collect("second", false);
  expect(order).toEqual(["a:second", "b:second"]);
});

test("the clock starts with the first move only, skips hidden time and never runs backwards", () => {
  const { run } = watched();
  expect(run.seconds(5000)).toBe(0);
  run.start(1000);
  run.start(3000);
  expect(run.startedAt).toBe(1000);
  expect(run.seconds(2499)).toBe(1);
  expect(run.seconds(2500)).toBe(2);
  run.skip(500);
  expect(run.startedAt).toBe(1500);
  expect(run.seconds(2500)).toBe(1);
  expect(run.seconds(0)).toBe(0);
});

test("the clock shows the run's second and stands still once the run is won", () => {
  const { run } = watched();
  expect(run.clock(5000)).toBe(0);
  run.start(0);
  expect(run.clock(5400)).toBe(5);
  run.arrive(GOAL);
  expect(run.clock(9000)).toBe(5);
});

test("the clock stands still once the game is over", () => {
  const { run } = watched();
  run.start(0);
  for (let life = LIVES; life > 0; life--) {
    run.hurt(true, 0, 0);
    expect(run.clock(3000)).toBe(3);
    run.recover();
    run.shield(0);
  }
  expect(run.gameOver).toBe(true);
  expect(run.clock(9000)).toBe(3);
});

test("a crystal counts, the secret one is kept apart", () => {
  const { run, seen } = watched();
  run.collect("crystal", false);
  expect(run).toMatchObject({ crystals: 1, secret: false });
  run.collect("purple", true);
  expect(run).toMatchObject({ crystals: 1, secret: true });
  expect(seen).toEqual([
    ["collected", { pickup: "crystal", secret: false }],
    ["collected", { pickup: "purple", secret: true }],
  ]);
});

test("a heart refills one life and stays where it is with all lives", () => {
  const { run, seen } = watched();
  run.heal("heart");
  expect(run.lives).toBe(LIVES);
  expect(seen).toEqual([]);
  run.hurt(false, 0, 0);
  seen.length = 0;
  run.heal("heart");
  expect(run.lives).toBe(LIVES);
  expect(seen).toEqual([["healed", { pickup: "heart" }]]);
});

test("a stomp squishes, scores by the chain and grants the next stomp its grace", () => {
  const { run, seen } = watched();
  run.meet("one", above(), bug(), false, 1000);
  expect(run).toMatchObject({ chain: 1, kills: 1, longestChain: 1, score: chainPoints(1), hits: 0 });
  run.meet("two", rising(), bug(), false, 1000 + STOMP_GRACE_MS);
  expect(run).toMatchObject({ chain: 2, kills: 2, longestChain: 2, score: chainPoints(1) + chainPoints(2) });
  expect(seen).toEqual([
    ["squished", { bug: "one", stomp: true, chain: 1, points: chainPoints(1) }],
    ["squished", { bug: "two", stomp: true, chain: 2, points: chainPoints(2) }],
  ]);
  // The second stomp renewed the grace; past it, the same touch hurts.
  run.meet("three", rising(), bug(), false, 1000 + 2 * STOMP_GRACE_MS);
  expect(run.kills).toBe(3);
  run.meet("four", rising(), bug(), false, 1000 + 3 * STOMP_GRACE_MS + 1);
  expect(run).toMatchObject({ kills: 3, hits: 1, lives: LIVES - 1 });
});

test("a dash squishes without a stomp and grants no grace", () => {
  const { run, seen } = watched();
  run.meet("one", beside(), bug(), true, 1000);
  expect(seen).toEqual([["squished", { bug: "one", stomp: false, chain: 1, points: chainPoints(1) }]]);
  run.meet("two", rising(), bug(), false, 1000);
  expect(run).toMatchObject({ kills: 1, hits: 1 });
});

test("standing on the ground ends the chain but keeps the longest one; a dash along the ground does not", () => {
  const { run } = watched();
  run.meet("one", above(), bug(), false, 0);
  run.meet("two", above(), bug(), false, 0);
  run.step(false, false);
  run.step(true, true);
  expect(run.chain).toBe(2);
  run.step(true, false);
  expect(run).toMatchObject({ chain: 0, longestChain: 2 });
  run.meet("three", above(), bug(), false, 0);
  expect(run).toMatchObject({ chain: 1, longestChain: 2 });
});

test("any other touch hurts, from the side he stands on", () => {
  const { run, seen } = watched();
  run.meet("one", beside(30), bug(10), false, 0);
  run.shield(0);
  run.meet("two", beside(10), bug(30), false, INVULNERABLE_MS);
  run.shield(INVULNERABLE_MS);
  run.meet("three", beside(10), bug(10), false, 2 * INVULNERABLE_MS);
  expect(run).toMatchObject({ lives: 0, hits: 3, kills: 0, score: 0 });
  expect(seen).toEqual([
    ["hurt", { fall: false, from: 1 }],
    ["hurt", { fall: false, from: -1 }],
    ["hurt", { fall: false, from: 0 }],
  ]);
});

test("while he blinks a touch does not hurt, a fall always does", () => {
  const { run, seen } = watched();
  run.shield(1000);
  expect(run.invulnerableUntil).toBe(1000 + INVULNERABLE_MS);
  run.hurt(false, 1, 1000 + INVULNERABLE_MS - 1);
  expect(seen).toEqual([]);
  run.hurt(true, 0, 1000 + INVULNERABLE_MS - 1);
  run.shield(1000);
  run.hurt(false, 1, 1000 + INVULNERABLE_MS);
  expect(run).toMatchObject({ lives: LIVES - 2, hits: 2 });
  expect(seen).toEqual([
    ["hurt", { fall: true, from: 0 }],
    ["hurt", { fall: false, from: 1 }],
  ]);
});

test("while a hit plays out nothing hits him again, until he moves again", () => {
  const { run, seen } = watched();
  run.hurt(true, 0, 0);
  run.hurt(true, 0, 0);
  run.hurt(false, 1, 0);
  expect(run).toMatchObject({ lives: LIVES - 1, hits: 1 });
  expect(seen).toEqual([["hurt", { fall: true, from: 0 }]]);
  expect(run.recover()).toBe(true);
  run.hurt(true, 0, 0);
  expect(run.lives).toBe(LIVES - 1);
  run.shield(0);
  run.hurt(true, 0, 0);
  expect(run).toMatchObject({ lives: LIVES - 2, hits: 2 });
});

test("he recovers while a life is left; the last one ends the game, once announced", () => {
  const { run, seen } = watched();
  run.hurt(true, 0, 0);
  run.shield(0);
  run.hurt(true, 0, 0);
  expect(run.recover()).toBe(true);
  expect(run.gameOver).toBe(false);
  run.shield(0);
  run.hurt(true, 0, 0);
  seen.length = 0;
  expect(run.recover()).toBe(false);
  expect(run.gameOver).toBe(true);
  expect(seen).toEqual([["gameOver", undefined]]);
});

test("with no life left nothing hits him: the lives never go below zero", () => {
  const { run, seen } = watched();
  for (let life = LIVES; life > 0; life--) {
    run.hurt(true, 0, 0);
    if (life > 1) run.shield(0);
  }
  run.recover();
  seen.length = 0;
  run.hurt(true, 0, 0);
  expect(run).toMatchObject({ lives: 0, hits: LIVES });
  expect(seen).toEqual([]);
});

test("a win stands over a hit that was still playing out", () => {
  const { run, seen } = watched();
  run.hurt(true, 0, 0);
  run.shield(0);
  run.hurt(true, 0, 0);
  run.shield(0);
  run.hurt(true, 0, 0);
  run.arrive(GOAL);
  seen.length = 0;
  expect(run.recover()).toBe(false);
  expect(run.gameOver).toBe(false);
  expect(seen).toEqual([]);
});

test("after the win nothing hits him", () => {
  const { run, seen } = watched();
  run.arrive(GOAL);
  seen.length = 0;
  run.hurt(true, 0, 0);
  expect(run).toMatchObject({ lives: LIVES, hits: 0 });
  expect(seen).toEqual([]);
});

test("a checkpoint he is past is where he goes on from", () => {
  const { run, seen } = watched();
  const { checkpoint } = run;
  run.pass("tree", 300, 300, 40);
  expect(checkpoint).toEqual({ x: 10, y: 20 });
  expect(seen).toEqual([]);
  run.pass("tree", 301, 300, 40);
  expect(run.checkpoint).toBe(checkpoint);
  expect(checkpoint).toEqual({ x: 300, y: 40 });
  expect(seen).toEqual([["checkpoint", { checkpoint: "tree" }]]);
});

test("a checkpoint is reached once: passed again, an earlier one does not take over", () => {
  const { run, seen } = watched();
  run.pass("first", 301, 300, 40);
  run.pass("second", 901, 900, 80);
  run.pass("first", 901, 300, 40);
  expect(run.checkpoint).toEqual({ x: 900, y: 80 });
  expect(seen).toEqual([
    ["checkpoint", { checkpoint: "first" }],
    ["checkpoint", { checkpoint: "second" }],
  ]);
});

test("he is at the last checkpoint once he has passed every one", () => {
  const { run } = watched(5, 2);
  expect(run.atLastCheckpoint).toBe(false);
  run.pass("first", 301, 300, 40);
  expect(run.atLastCheckpoint).toBe(false);
  run.pass("second", 901, 900, 80);
  expect(run.atLastCheckpoint).toBe(true);
  expect(watched(5, 0).run.atLastCheckpoint).toBe(true);
});

test("the run is won past the finish line, once", () => {
  const { run, seen } = watched();
  run.arrive(LINE);
  expect(run.won).toBe(false);
  expect(seen).toEqual([]);
  run.arrive(LINE + 1);
  expect(run.won).toBe(true);
  const { score } = run;
  run.arrive(LINE + 2);
  expect(run.score).toBe(score);
  expect(seen).toHaveLength(1);
});

test.each([
  [GOLD_TIME - 1, true],
  [GOLD_TIME, false],
])("a win at %i s replaces the bug points with the awards", (time, gold) => {
  const { run, seen } = watched(1);
  run.collect("crystal", false);
  run.meet("one", above(), bug(), false, 0);
  const awards = winAwards(run, gold);
  run.start(0);
  run.clock(time * 1000);
  run.arrive(GOAL);
  expect(run.won).toBe(true);
  expect(run.score).toBe(awardTotal(awards));
  expect(run.score).not.toBe(chainPoints(1));
  expect(seen.at(-1)).toEqual(["won", { time, gold, awards }]);
});
