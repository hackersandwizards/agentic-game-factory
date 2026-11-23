import { fc, test } from "@fast-check/vitest";
import { expect } from "vitest";
import { findLinePlacement } from "../examples/present/ui/placement";

test.prop([fc.integer({ min: -200, max: 300 }), fc.integer({ min: -200, max: 180 })])(
  "clamps a clear popup to the horizontal edges and raises its bottom above the room's top",
  (x, y) => {
    const line = { x, y, width: 20, height: 10, left: 10, right: 190, beside: 70, across: 130 };
    const point = findLinePlacement(line, [], { top: 20, bottom: 200 });
    expect(point).toEqual({ x: x < 10 ? 10 : x > 190 ? 190 : x, y: y < 30 ? 30 : y });
  },
);
