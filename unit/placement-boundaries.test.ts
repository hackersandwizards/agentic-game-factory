import { expect, test } from "vitest";
import { findLinePlacement, lineLimit } from "../examples/present/ui/placement";

test("an upper hint changes the top limit only where it overlaps the line", () => {
  const room = {
    top: 0,
    bottom: 200,
    hint: { left: 90, right: 110, top: 30, bottom: 40, above: true },
  };
  expect(lineLimit(room, 100, 20, true)).toBe(40);
  expect(lineLimit(room, 100, 20, false)).toBe(200);
  expect(lineLimit(room, 80, 20, true)).toBe(0);
  expect(lineLimit(room, 120, 20, true)).toBe(0);
});

test("a popup keeps its position when it only touches an obstacle edge", () => {
  const line = { x: 100, y: 100, width: 20, height: 10, left: 10, right: 190, beside: 70, across: 130 };
  const edges = [
    { left: 70, right: 90, top: 85, bottom: 105 },
    { left: 110, right: 130, top: 85, bottom: 105 },
    { left: 90, right: 110, top: 75, bottom: 90 },
    { left: 90, right: 110, top: 100, bottom: 120 },
  ];
  for (const edge of edges) {
    expect(findLinePlacement(line, [edge], { top: 0, bottom: 200 })).toEqual({ x: 100, y: 100 });
  }
});
