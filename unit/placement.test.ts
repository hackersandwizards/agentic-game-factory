import { expect, test } from "vitest";
import { findLinePlacement } from "../examples/present/ui/placement";

const line = { x: 100, y: 100, width: 20, height: 10, left: 10, right: 190, beside: 70, across: 130 };
const obstacle = { left: 90, right: 110, top: 85, bottom: 105 };

test("tries stacking above an obstacle before stacking below", () => {
  expect(findLinePlacement(line, [obstacle], { top: 0, bottom: 200 })).toEqual({ x: 100, y: 81 });
  expect(findLinePlacement(line, [obstacle], { top: 80, bottom: 200 })).toEqual({ x: 100, y: 119 });
});

test("tries beside the wizard before the other side and uses each candidate's own room", () => {
  const wall = { ...obstacle, top: 0, bottom: 200 };
  const wholeRoom = { top: 0, bottom: 200 };
  expect(findLinePlacement(line, [wall], wholeRoom)).toEqual({ x: 70, y: 100 });
  expect(
    findLinePlacement(line, [wall], {
      top: 0,
      bottom: 200,
      hint: { left: 60, right: 80, top: 60, bottom: 80, above: false },
    }),
  ).toEqual({
    x: 130,
    y: 100,
  });
});

test("falls back inside the view and under the room's top if every candidate is blocked", () => {
  const wall = { left: 0, right: 200, top: 0, bottom: 200 };
  expect(findLinePlacement({ ...line, x: 205 }, [wall], { top: 100, bottom: 200 })).toEqual({
    x: 190,
    y: 110,
  });
});
