import { fc, test } from "@fast-check/vitest";
import { expect } from "vitest";
import { unicodeString } from "./property-setup";
import { earnsGold, formatClock, rankAbove, rank, RANKS, readRecord } from "../examples/present/domain/score";

test.prop([fc.integer()], { examples: [[-1], [0], [2499], [2500], [3499], [3500], [4599], [4600]] })(
  "uses the highest reached rank and points to the lowest remaining goal",
  (score) => {
    const reached = RANKS.filter(([, minimum]) => minimum <= Math.max(score, 0));
    const remaining = RANKS.filter(([, minimum]) => minimum > Math.max(score, 0));
    expect(rank(score)).toBe(reached[0][0]);
    expect(rankAbove(score)).toEqual(remaining.at(-1));
  },
);

test.prop([fc.integer({ min: 0 })], { examples: [[0], [29], [30], [31]] })(
  "awards gold strictly before 30 seconds",
  (seconds) => {
    expect(earnsGold(seconds)).toBe(seconds < 30);
  },
);

test.prop([fc.maxSafeNat()], { examples: [[0], [9], [10], [59], [60], [129], [Number.MAX_SAFE_INTEGER]] })(
  "formats whole seconds as minutes and exactly two seconds digits",
  (seconds) => {
    const clock = formatClock(seconds);
    expect(clock).toMatch(/^(?:0|[1-9]\d*):[0-5]\d$/);
    const [minutes, remainder] = clock.split(":").map(Number);
    expect(minutes * 60 + remainder).toBe(seconds);
  },
);

test.prop(
  [
    fc.array(
      fc.oneof(fc.constant(null), unicodeString, fc.double().map(String), fc.maxSafeNat().map(String)),
      { minLength: 1 },
    ),
  ],
  {
    examples: [
      [
        [
          null,
          "",
          "é",
          "1".repeat(1024),
          "constructor",
          "__proto__",
          "toString",
          "0",
          "-0",
          String(Number.MAX_SAFE_INTEGER),
          " 0x10 ",
          "-100",
          "-Infinity",
          "Infinity",
          "NaN",
          "1.5",
          "9007199254740992",
        ],
      ],
    ],
  },
)("accepts stored text only when it converts to a nonnegative safe integer", (records) => {
  for (const text of records) {
    const converted = Number(text);
    const valid = Number.isInteger(converted) && converted >= 0 && converted <= Number.MAX_SAFE_INTEGER;
    expect(readRecord(text)).toBe(valid ? converted : 0);
  }
});
