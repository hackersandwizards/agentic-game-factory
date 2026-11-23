import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  clock,
  finish,
  level,
  openTitle,
  startAutopilot,
  startLevel,
  waitForLevel,
  type Level,
} from "./game";

// Frame-time probe: the autopilot plays the example for 10 s; prints the WebGL renderer, the median
// and 95th percentile frame time, and Phaser's own work per frame. Headless Chrome renders on the GPU
// where it has one (on a Mac: "ANGLE Metal Renderer: Apple ..."); without one it falls back to
// SwiftShader on the CPU, whose numbers compare only with each other. It runs once as shipped and once
// with 18+ mode's blood on.
//
// Frame time is the wall clock between animation frames, read with performance.now() inside each
// callback. The callback's own timestamp is no clock: headless Chrome spaces it evenly however long a
// frame took, so a probe built on it never fails. Phaser's work is the time from its prestep to its
// postrender event, the CPU side of one frame. The control test below adds 22 ms of busy work to every
// 10th frame and must see it: a probe that misses a slow frame proves nothing. These are desktop browser
// numbers, not phone numbers.
//
// Physics steps at a fixed 60 Hz, so it plays the same at any refresh rate. A frame then takes 0 or 2
// steps wherever frame times drift past the step: at 59.94 Hz, 75 Hz or 144 Hz, or where timestamps
// wobble around a step boundary. The wizard and the bugs are drawn between their last two steps, so they
// move evenly anyway. The tests below drive the game with a clock of even timestamps at a chosen rate, one
// period per animation frame, whatever headless Chrome's own rate: its timestamps are too even to drift. At
// 57 Hz the fixed step takes 0 or 2 steps in about 1 frame in 20, every run alike; at 120 Hz every other
// frame takes none. The judder tests count frames of steady motion where the drawn step changes by more
// than a limit; their controls draw at the last step instead, as before, and must count them. The jump test holds jump from standing at 30, 60, 120 and 144 Hz and compares the
// heights; its control turns the fixed step off, so each step lasts one frame, and must see them differ.

const rendererOf = (page: Page) =>
  page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl")!;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "unknown";
  });

/** Wall-clock frame gaps and Phaser's work per frame over `frames` frames, in ms. */
async function probe(page: Page, frames: number) {
  return page.evaluate(
    (frames) =>
      new Promise<{ renderer: string; gaps: number[]; work: number[] }>((resolve) => {
        const gl = document.createElement("canvas").getContext("webgl")!;
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "unknown";
        const work: number[] = [];
        let begin = 0;
        const step = () => (begin = performance.now());
        const render = () => work.push(performance.now() - begin);
        window.game.events.on("prestep", step);
        window.game.events.on("postrender", render);
        const gaps: number[] = [];
        let last = performance.now();
        const tick = () => {
          const now = performance.now();
          gaps.push(now - last);
          last = now;
          if (gaps.length < frames + 10) return requestAnimationFrame(tick);
          window.game.events.off("prestep", step);
          window.game.events.off("postrender", render);
          resolve({ renderer, gaps: gaps.slice(10), work: work.slice(10) });
        };
        requestAnimationFrame(tick);
      }),
    frames,
  );
}

const percentile = (values: number[], p: number) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length * p)];

for (const gore of [false, true])
  test(`example runs smoothly${gore ? " in 18+ mode" : ""}`, async ({ page }) => {
    test.setTimeout(60_000);
    if (gore) await page.addInitScript(() => localStorage.setItem("present-18plus", "1"));
    await startAutopilot(page);
    const { renderer, gaps, work } = await probe(page, 600);
    // How many splats the run left: the 18+ measurement only counts if the autopilot squished bugs.
    if (gore) {
      const splats = await page.evaluate(
        `window.game.scene.getScene("level").children.list.filter((o) => o.name === "blood" && o.visible).length`,
      );
      console.log(`18+ on: ${String(splats)} splats on the ground`);
    }
    const p95 = percentile(gaps, 0.95);
    const swiftShader = renderer.includes("SwiftShader");
    console.log(
      `renderer ${renderer}${swiftShader ? " (SwiftShader: CPU rendering, compare only with itself)" : ""}`,
    );
    console.log(
      `${gore ? "18+ on" : "18+ off"}: frame time median ${percentile(gaps, 0.5).toFixed(1)} ms, p95 ${p95.toFixed(1)} ms; Phaser work p95 ${percentile(work, 0.95).toFixed(1)} ms`,
    );
    // On a GPU, p95 under 25 ms means at most an occasional dropped frame at 60 fps. SwiftShader renders on
    // the CPU, so there only a stall fails.
    expect(p95, `p95 frame time on ${renderer}`).toBeLessThan(swiftShader ? 100 : 25);
  });

// The probe's control: 22 ms of busy work in every 10th frame must read as a p95 over 25 ms, or the
// probe above could not fail.
test("the frame-time probe sees slow frames", async ({ page }) => {
  await openTitle(page);
  await page.evaluate(() => {
    let n = 0;
    window.game.events.on("step", () => {
      const start = performance.now();
      if (++n % 10 === 0) while (performance.now() - start < 22);
    });
  });
  const { gaps, work } = await probe(page, 300);
  expect(percentile(gaps, 0.95)).toBeGreaterThan(25);
  expect(percentile(work, 0.95)).toBeGreaterThan(20);
});

/** How high a held jump from standing lifts his feet at each rate, with the fixed physics step or without it. */
async function jumpHeights(browser: Browser, fixed: boolean) {
  const heights: Record<number, number> = {};
  for (const hz of [30, 60, 120, 144]) {
    const page = await browser.newPage();
    await page.addInitScript(clock, hz);
    await startLevel(page);
    await page.evaluate(
      (fixed) => (window.game.scene.getScene("level").physics.world.fixedStep = fixed),
      fixed,
    );
    await page.waitForFunction(
      `(${level.toString()})().player.grounded && (${level.toString()})().player.body.velocity.x === 0`,
    );
    // Highest point of his feet, read after every physics step, from the jump until he lands.
    heights[hz] = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const l = window.game.scene.getScene("level") as Level;
          const [world, body, start] = [l.physics.world, l.player.body, l.player.body.bottom];
          let [top, left] = [start, false];
          const step = () => {
            top = Math.min(top, body.bottom);
            left ||= !l.player.grounded;
            if (!left || !l.player.grounded) return;
            world.off("worldstep", step);
            l.player.pad.jump = false;
            resolve(start - top);
          };
          l.player.pad.jump = true;
          world.on("worldstep", step);
        }),
    );
    await page.close();
  }
  return heights;
}
/** The largest difference in px between the jump at 60 Hz and at another rate. */
const spread = (heights: Record<number, number>) =>
  Math.max(...[30, 120, 144].map((hz) => Math.abs(heights[hz] - heights[60])));

// A held jump from standing rises the same at every refresh rate.
test("a held jump rises as high at 30, 60, 120 and 144 Hz", async ({ browser }) => {
  test.setTimeout(90_000);
  const heights = await jumpHeights(browser, true);
  console.log(`jump heights: ${JSON.stringify(heights)}`);
  expect(spread(heights)).toBeLessThan(3);
});

// The jump test's control: with a physics step as long as each frame, the same jump differs between rates
// (measured: 89 px at 30 Hz to 135 px at 144 Hz, 117 at 60), far past the 3 px the test allows.
test("the jump test sees a variable physics step", async ({ browser }) => {
  test.setTimeout(90_000);
  const heights = await jumpHeights(browser, false);
  console.log(`jump heights, variable step: ${JSON.stringify(heights)}`);
  expect(spread(heights)).toBeGreaterThan(10);
});

/**
 * Judder at an `hz` clock: frames of steady motion in which a drawn object's on-screen step changes by more than
 * `limit` px, and the largest change seen in such a frame. The wizard is read while the autopilot runs, 600
 * frames; the bugs while he stands at the door, 300 frames of every bug, or ("bugs moving") while the autopilot runs
 * and the camera follows him, 600 frames. Steady means the same horizontal speed for four frames before, no vertical
 * speed (a bug) and no hit-stop; every step is read on the screen.
 */
async function jerks(
  page: Page,
  hz: number,
  smooth: boolean,
  who: "wizard" | "bugs" | "bugs moving",
  limit: number,
) {
  await page.addInitScript(clock, hz);
  if (who !== "bugs") await startAutopilot(page);
  else await startLevel(page);
  const tracks = await page.evaluate(
    ([smooth, who]) =>
      new Promise<number[][][]>((resolve) => {
        const l = window.game.scene.getScene("level") as Level & {
          player: { sprite: { x: number }; smooth: boolean };
          smoothBugs: boolean;
        };
        if (who === "wizard") l.player.smooth = smooth;
        else l.smoothBugs = smooth;
        const cam = l.cameras.main;
        const bugs = l.bugs.getChildren() as Phaser.Physics.Arcade.Sprite[];
        // Per object and frame: drawn position in screen px, horizontal speed, and whether the frame is unsteady.
        const tracks: number[][][] = who === "wizard" ? [[]] : bugs.map(() => []);
        const end = () => {
          const paused = l.physics.world.isPaused;
          if (who === "wizard")
            tracks[0].push([(l.player.sprite.x - cam.scrollX) * cam.zoom, l.player.body.velocity.x, +paused]);
          else
            bugs.forEach((bug, i) => {
              const body = bug.body as Phaser.Physics.Arcade.Body | null;
              tracks[i].push(
                body
                  ? [(bug.x - cam.scrollX) * cam.zoom, body.velocity.x, +(paused || body.velocity.y !== 0)]
                  : [0, 0, 1],
              );
            });
          if (tracks[0].length < (who === "bugs" ? 300 : 600)) return;
          window.game.events.off("postrender", end);
          resolve(tracks);
        };
        window.game.events.on("postrender", end);
      }),
    [smooth, who] as const,
  );
  let [count, max] = [0, 0];
  const changes: number[] = [];
  for (const frames of tracks)
    for (let i = 4; i < frames.length; i++) {
      const steady =
        frames[i][1] !== 0 &&
        !frames[i][2] &&
        [1, 2, 3, 4].every((k) => frames[i - k][1] === frames[i][1] && !frames[i - k][2]);
      if (!steady) continue;
      const [a, b, c] = [frames[i][0], frames[i - 1][0], frames[i - 2][0]];
      const change = Math.abs(a - b - (b - c));
      changes.push(change);
      max = Math.max(max, change);
      if (change > limit) count++;
    }
  return { count, max, p95: changes.length ? percentile(changes, 0.95) : NaN, n: changes.length };
}

// Drawn between his last two physics steps, on whole screen pixels, the wizard runs without jerks where frames take
// 0 or 2 steps. Rounded once against where the camera eases, which draws on whole screen pixels too, his step changes
// by about 1 screen px a frame (measured: p95 1.0 px, at most 2.0 px, at 57, 60 and 120 Hz; against the unrounded
// camera before, p95 1.0 to 1.1 px, at most 2.6 px), under the 6 px limit; one step is 11 px on the 1920 px canvas.
test("the wizard moves evenly on screen when frame times drift past the physics step", async ({ page }) => {
  test.setTimeout(60_000);
  const { count, max, n } = await jerks(page, 57, true, "wizard", 6);
  console.log(`judder at 57 Hz: ${count} jerks, largest change ${max.toFixed(2)} px`);
  expect(n).toBeGreaterThan(0);
  expect(count).toBe(0);
});

// The judder test's control: drawn at his last step, as before, he jerks (measured: 42 to 45 jerks).
test("the judder count sees the wizard drawn at his last step", async ({ page }) => {
  test.setTimeout(60_000);
  const { count } = await jerks(page, 57, false, "wizard", 6);
  console.log(`judder control: ${count} jerks`);
  expect(count).toBeGreaterThan(20);
});

// The bugs are drawn between their steps too: at 120 Hz, drawn at their last step, they stood still on every other
// frame, and at 57 Hz they took a double step about once in 20 frames. A bug's step is 3 or 6 screen px. They draw
// off the whole pixels the camera draws on, against where it eases, so their step on screen stays smooth: rounded,
// it changed by 1 screen px now and then (measured on whole pixels: standing 1.0 px at 57 and 120 Hz, with the
// camera moving p95 1.0 px, at most 2.0; smooth: standing 0.0, moving p95 0.04 to 0.26 px, at most 1.06 px, the
// camera's own easing). With the view leading him by his speed (systems/camera.ts LAG), it eases more: moving p95 0.08 to
// 0.45 px, at most 1.54 px; uneased, the lead stepped with each physics step and made 0.62 px at 57 Hz.
// The track is bug.x, the drawn position: a walking bug's bob and footfall squash (entities/bugs.ts stepBug) move it only up
// and down and scale it about its centre, so its horizontal step on screen stays the body's. A turn squeezes it
// about the same centre, and a turning bug is no steady motion.
test("the bugs move smoothly on screen at 57 and 120 Hz", async ({ browser }) => {
  test.setTimeout(180_000);
  for (const hz of [57, 120]) {
    for (const who of ["bugs", "bugs moving"] as const) {
      const page = await browser.newPage();
      const { count, max, n, p95 } = await jerks(page, hz, true, who, 0.5);
      console.log(
        `${who} judder at ${hz} Hz: ${count} jerks, p95 ${p95.toFixed(2)} px, largest ${max.toFixed(2)} px`,
      );
      expect(n, `${who} ${hz} Hz`).toBeGreaterThan(0);
      if (who === "bugs") expect(count, `${hz} Hz`).toBe(0);
      else expect(p95, `${hz} Hz`).toBeLessThan(0.5);
      await page.close();
    }
  }
});

// The bug judder test's control: drawn at their last step, the bugs jerk at 120 Hz.
test("the bug judder count sees bugs drawn at their last step", async ({ page }) => {
  test.setTimeout(60_000);
  const { count } = await jerks(page, 120, false, "bugs", 1);
  console.log(`bug judder control: ${count} jerks`);
  expect(count).toBeGreaterThan(20);
});

// First uses freeze no frame: Start, the first win and the restart each hold no frame over 100 ms, the wall clock
// between animation frames read from the Enter that starts each until a second after the wizard can move or the panel
// is done. Made in the title's Enter, the AudioContext held that frame 140 to 160 ms (measured on an Apple M3 Max,
// ANGLE Metal; after: 33 to 40 ms, the level's first frame; the first win and the restart 18 to 21 ms). SwiftShader
// renders on the CPU, so there it only prints.
test("Start, the first win and the restart freeze no frame", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    const w = window as unknown as { gaps: number[] };
    w.gaps = [];
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      w.gaps.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await openTitle(page);
  await page.waitForTimeout(1000);
  const longest = async (act: () => Promise<void>) => {
    await page.evaluate(() => ((window as unknown as { gaps: number[] }).gaps.length = 0));
    await act();
    await page.waitForTimeout(1000);
    return page.evaluate(() => Math.max(...(window as unknown as { gaps: number[] }).gaps));
  };
  const enter = async () => {
    await page.keyboard.press("Enter");
    await waitForLevel(page);
  };
  const frames = {
    start: await longest(enter),
    win: await longest(() => finish(page)),
    restart: await longest(enter),
  };
  const renderer = await rendererOf(page);
  console.log(`longest frames on ${renderer}: ${JSON.stringify(frames)} ms`);
  if (!renderer.includes("SwiftShader"))
    for (const [use, ms] of Object.entries(frames)) expect(ms, use).toBeLessThan(100);
});
