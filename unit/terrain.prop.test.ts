import { fc, test } from "@fast-check/vitest";
import { expect } from "vitest";
import { Terrain } from "../examples/present/domain/terrain";

test.prop([fc.nat({ max: 30 }), fc.integer({ min: 1, max: 3 }), fc.boolean()])(
  "reads ground at the tile edge or four pixels lower for a plank",
  (column, row, plank) => {
    const rows = Array<string>(row + 1).fill("");
    rows[row] = ".".repeat(column) + (plank ? "=" : "#");
    const terrain = new Terrain(rows, { gravity: 3600, maxFall: 600 });
    expect(terrain.groundBelow(column * 48 + 47, 0)).toBe(row * 48 + (plank ? 4 : 0));
  },
);
