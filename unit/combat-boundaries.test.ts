import { expect, test } from "vitest";
import { isStomp } from "../examples/present/domain/combat";

test("equal vertical velocities do not count as a stomp after grace", () => {
  const body = { prev: { y: 0 }, height: 14, velocity: { y: 30 } };
  const bug = { prev: { y: 20 }, velocity: { y: 30 } };
  expect(isStomp(body, bug, 101, 100)).toBe(false);
});
