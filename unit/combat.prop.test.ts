import { fc, test } from "@fast-check/vitest";
import { expect } from "vitest";
import { chainPoints } from "../examples/present/domain/combat";

test.prop([fc.nat({ max: 1000 })], { examples: [[0], [1], [4]] })(
  "awards another hundred points for every kill in the chain",
  (chain) => {
    expect(chainPoints(chain)).toBe(100 * chain);
  },
);
