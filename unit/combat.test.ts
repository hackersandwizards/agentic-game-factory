import { expect, test } from "vitest";
import { isStomp, LIVES, STOMP_GRACE_MS } from "../examples/present/domain/combat";

test("starts with three lives and gives a stomp 100 ms of grace", () => {
  expect(LIVES).toBe(3);
  expect(STOMP_GRACE_MS).toBe(100);
});

test("checks the feet before the physics step and the relative fall speed", () => {
  const body = { prev: { y: 10 }, height: 14, velocity: { y: -3 } };
  const bug = { prev: { y: 20 }, velocity: { y: -4 } };
  expect(isStomp(body, bug, 101, 100)).toBe(true);
  body.prev.y++;
  expect(isStomp(body, bug, 100, 100)).toBe(false);
});

test("grants a second stomp at the last instant of grace even after the bounce", () => {
  const body = { prev: { y: 0 }, height: 14, velocity: { y: -50 } };
  const bug = { prev: { y: 20 }, velocity: { y: 0 } };
  expect(isStomp(body, bug, 100, 100)).toBe(true);
  expect(isStomp(body, bug, 101, 100)).toBe(false);
});
