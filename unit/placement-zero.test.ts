import { expect, test } from "vitest";
import { findLinePlacement } from "../examples/present/ui/placement";

test("keeps a free placement whose bottom is exactly zero", () => {
  const line = { x: 100, y: -20, width: 20, height: 10, left: 10, right: 190, beside: 70, across: 130 };
  const obstacles = [
    { left: 90, right: 110, top: -10, bottom: 0 },
    { left: 120, right: 140, top: -10, bottom: 0 },
  ];
  expect(findLinePlacement(line, obstacles, { top: -10, bottom: 0 })).toEqual({ x: 70, y: 0 });
});
