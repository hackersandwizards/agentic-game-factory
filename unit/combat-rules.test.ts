import { expect, test } from "vitest";
import { chainEnds, HIT_MS, INVULNERABLE_MS, killsBug } from "../examples/present/domain/combat";

test("ends the chain only while grounded and outside a dash", () => {
  expect(chainEnds(true, false)).toBe(true);
  expect(chainEnds(true, true)).toBe(false);
  expect(chainEnds(false, false)).toBe(false);
  expect(chainEnds(false, true)).toBe(false);
});

test("either a stomp or a dash kills a bug, including a dashing stomp", () => {
  expect(killsBug(false, false)).toBe(false);
  expect(killsBug(true, false)).toBe(true);
  expect(killsBug(false, true)).toBe(true);
  expect(killsBug(true, true)).toBe(true);
});

test("the shield after a hit lasts 1000 ms", () => {
  expect(INVULNERABLE_MS).toBe(1000);
});

test("a hit plays out for 400 ms", () => {
  expect(HIT_MS).toBe(400);
});
