# Performance, 2026-11-22

Both pages of the build, measured before and after the polish pass of 2026-11-22. Before is commit
6ff7c9b, after is the commit that adds this file.

## What changed

- The example's eight art files ship as lossless WebP instead of PNG, pixel for pixel the same
  (every decoded RGBA byte compared): 700,622 bytes became 424,520.
- The level's draw step (`lateUpdate` in `levels/level-scene.ts`, `stepBug` in `entities/bugs.ts`) builds no array and no closure per frame any more.

## Page load

Seven cold loads per page and CPU setting, median, in headless Chrome for Testing at 1280x720
against `vite preview` on localhost, which compresses text. Before and after ran back to back on an
Apple M3 Max with a 1-minute load of 13.6 and 12.7 on 16 cores. Times are in ms. "First frame" is
Phaser's first rendered frame, which comes before the level's textures are decoded.

| Page                 | CPU | Transfer before | Transfer after | First paint | First frame | Load event |
| -------------------- | --- | --------------- | -------------- | ----------- | ----------- | ---------- |
| `/`                  | 1x  | 373,453 B       | 373,459 B      | 40 -> 36    | 90 -> 90    | 78 -> 80   |
| `/`                  | 4x  | 373,453 B       | 373,459 B      | 60 -> 60    | 260 -> 286  | 244 -> 258 |
| `/examples/present/` | 1x  | 1,338,332 B     | 1,062,169 B    | 80 -> 84    | 86 -> 89    | 63 -> 65   |
| `/examples/present/` | 4x  | 1,338,332 B     | 1,062,169 B    | 240 -> 236  | 282 -> 281  | 186 -> 183 |

The example page downloads 276 kB less, 20.6 %. The times moved by less than they vary between
runs on a loaded machine: on localhost the download costs nothing, so the saving shows on a real
connection, which this run did not measure. Requests stay at 10 and 28. `dist/` went from 2,388 to
2,124 kB on disk.

## Frame time

From `tests/perf.spec.ts` in the full check, 600 frames with the autopilot playing, same machine,
ANGLE Metal, one run before and two after:

|        | Frame time median | Frame time p95 | Phaser work p95 |
| ------ | ----------------- | -------------- | --------------- |
| Before | 16.7 ms           | 17.5 ms        | 1.8 ms          |
| After  | 16.7 ms           | 17.5, 17.3 ms  | 1.7, 2.1 ms     |

The frame budget was met before and is met after: removing the per-frame allocations changes
nothing a desktop measures. These are desktop numbers, not phone numbers.

## What is left

Phaser is 1,367,745 bytes of the build, 352 kB compressed, and the title picture 235,972. Both pages
load Phaser whole. A custom Phaser build would cut that and was not tried: it changes what the kit's
users can call.
