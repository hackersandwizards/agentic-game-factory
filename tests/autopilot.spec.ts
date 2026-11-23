import { expect, test, type Page } from "@playwright/test";
import {
  bugsOff,
  clock,
  finish,
  level,
  openTitle,
  placeBug,
  startAutopilot,
  startFinish,
  startLevel,
  texts,
  waitForLevel,
} from "./game";

// Every test opens its own page, so they run side by side: the finish runs take about 35 s each.
test.describe.configure({ mode: "parallel" });

// The example level stays finishable: the autopilot may lose lives, but it must reach the laptop, whenever it
// starts: started late, it meets the bugs at other points of their patrols. 300 ms guards a past regression:
// started 200-400 ms late, it dashed off the high route into the pit after the landing.
// The wizard stops clear of the laptop, so he never hides the win. Then Enter plays again, as on GAME OVER.
// On the way neither the HUD nor the line on how to play covers him: on the high route the camera kept his head 4 px
// below the view's top, under the HUD, in about 65 frames a run, and on a phone held sideways "JUMP, THEN DASH BUTTON
// TO DASH" lay across his hat in 108 to 128. Both are read in view pixels as each frame is drawn: his frame's bounds on
// the world camera, the HUD's backing and the line on the UI camera, which shows the 960x540 grid unscrolled. Each run
// plays on another landscape screen, the touch ones with the touch hints. Nor does a touch button cover him: on a phone
// held sideways they stand in the view's lower corners (an 844x390 phone, and a 667x375 one, where the canvas fills
// the screen), read on the page in CSS px; on the larger screen they are drawn on the canvas, read on the UI camera.
// Nor does one cover where he lands: on the 667x375 phone DASH stood over the ground ahead. The landing spot, his
// feet's middle where he next stands, is read back over the last 15 frames before he lands (a quarter second to see
// it) wherever it showed in the view, in each frame's own view.
for (const [delay, width, height, touch] of [
  [0, 844, 390, true],
  [500, 667, 375, true],
  [300, 1280, 720, true],
  [700, 1920, 1080, false],
] as const)
  test(`an autopilot finishes the example level at ${width}x${height}, starting after ${delay} ms`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    await startAutopilot(page, true, delay);
    await page.evaluate(`(() => {
      const l = (${level.toString()})(), hud = l.children.getByName("hud");
      window.covered = { hud: 0, help: 0, pad: 0, landing: 0 };
      let frames = [];
      window.padSeen = 0;
      const over = (s, h) => s.x < h.right && h.x < s.right && s.y < h.bottom && h.y < s.bottom;
      const pad = document.getElementById("pad");
      window.game.events.on("postrender", () => {
        const s = l.player.sprite.getBounds(), v = l.cameras.main.worldView;
        s.x -= v.x;
        s.y -= v.y;
        if (hud.active && hud.visible && over(s, l.hudBacking.getBounds())) window.covered.hud++;
        if (l.help.active && l.help.visible && l.help.alpha > 0 && over(s, l.help.getBounds())) window.covered.help++;
        const drawn = l.children.list.filter((o) => o.name === "controls" && o.texture?.key === "pad" && o.visible);
        const c = l.game.canvas.getBoundingClientRect(), k = c.width / 960;
        const css = { x: c.x + s.x * k, y: c.y + s.y * k, right: c.x + s.right * k, bottom: c.y + s.bottom * k };
        const buttons = pad.hidden ? [] : [...pad.children].map((b) => b.getBoundingClientRect());
        if (drawn.length || buttons.length) window.padSeen++;
        if (drawn.some((o) => over(s, o.getBounds())) || buttons.some((b) => over(css, b))) window.covered.pad++;
        const rects = [...drawn.map((o) => o.getBounds()), ...buttons.map((b) => ({ x: (b.x - c.x) / k, y: (b.y - c.y) / k, right: (b.right - c.x) / k, bottom: (b.bottom - c.y) / k }))];
        if (!l.player.grounded) frames = [...frames.slice(-14), [v.x, v.y, v.width, v.height, rects]];
        else if (frames.length) {
          const [x, y] = [l.player.body.center.x, l.player.body.bottom];
          for (const [vx, vy, w, h, rs] of frames)
            if (x > vx && x < vx + w && y > vy && y < vy + h && rs.some((r) => over({ x: x - vx, y: y - vy, right: x - vx, bottom: y - vy }, r))) window.covered.landing++;
          frames = [];
        }
      });
    })()`);
    const won = () => page.evaluate(`(${level.toString()})().won`);
    await expect.poll(won, { timeout: 100_000, intervals: [1000] }).toBe(true);
    expect(
      await page.evaluate(`window.covered`),
      "frames the HUD, the help or a touch button covered him or where he lands",
    ).toEqual({
      hud: 0,
      help: 0,
      pad: 0,
      landing: 0,
    });
    // The pad count read buttons: on the desktop run, none show.
    expect(((await page.evaluate(`window.padSeen`)) as number) > 0).toBe(touch);
    await page.waitForTimeout(1300);
    const gap = await page.evaluate(
      `(() => { const l = (${level.toString()})(); return l.laptop.x - l.player.sprite.x; })()`,
    );
    expect(gap).toBeGreaterThan(60);
    // He shows solid, and the foreground strip (screen-fixed, on the zoomed camera) stays below his feet.
    const seen = await page.evaluate(`(() => {
    const l = (${level.toString()})(), c = l.cameras.main, s = l.player.sprite;
    const padY = (c.height - c.height / c.zoom) / 2;
    return { alpha: s.alpha, present: l.present.alpha, clear: s.getBounds().bottom - c.worldView.y < l.foreground.y - padY };
  })()`);
    expect(seen).toEqual({ alpha: 1, present: 1, clear: true });
    await page.keyboard.press("Enter");
    await expect.poll(won).toBe(false);
    await page.close();
  });

// The autopilot thinks in physics steps, as the wizard does: thinking once a drawn frame, with its waits counted in
// frames, it held jump twice as long at 30 Hz and never reached the laptop. At 30 Hz the game runs two steps a frame.
test("an autopilot finishes the example level at 30 Hz", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(clock, 30);
  await startAutopilot(page);
  await expect
    .poll(() => page.evaluate(`(${level.toString()})().won`), { timeout: 100_000, intervals: [1000] })
    .toBe(true);
});

// The win panel shows the run's time and score with the best ones this browser kept; junk in storage is no best.
test("the win replaces corrupt records and keeps valid bests", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("present-best-time", "-1");
    localStorage.setItem("present-best-score", "Infinity");
  });
  await startLevel(page);
  await finish(page);
  // Unhurt and under the gold time, with nothing collected: 500 + 500, rank C. finish() runs 25 s, above the best of
  // 0:01 set below.
  let panel = (await texts(page)).join("|");
  expect(panel).toContain("TIME 0:25 500");
  expect(panel).toContain("SCORE 1000 RANK C");
  expect(panel).toContain("NEW BEST SCORE, TIME");
  expect(await page.evaluate(() => localStorage.getItem("present-best-time"))).toBe("25");
  expect(await page.evaluate(() => localStorage.getItem("present-best-score"))).toBe("1000");

  await page.evaluate(() => {
    localStorage.setItem("present-best-time", "1");
    localStorage.setItem("present-best-score", "6000");
  });
  await page.waitForTimeout(1300);
  await page.keyboard.press("Enter");
  await waitForLevel(page);
  await finish(page);
  panel = (await texts(page)).join("|");
  expect(panel).toContain("BEST 6000 S, 0:01");
});

// A win before the door has closed behind him, as in a level whose laptop stands by the door, shows the time as 0:00:
// counted from Infinity, it read "TIME -Infinity:NaN".
test("a win before he can move shows the time as 0:00", async ({ page }) => {
  await openTitle(page);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.game.scene.isActive("level"));
  await page.evaluate(
    `(() => { const l = (${level.toString()})(); l.player.moveTo(l.laptop.x - 100, l.laptop.y - 60); })()`,
  );
  await page.waitForFunction(`(${level.toString()})().children.getByName("panel")?.getData("done")`);
  expect((await texts(page)).join("|")).toContain("TIME 0:00 500");
});

// The run home bites: after the last checkpoint tree a fast bug patrols.
test("a fast bug waits after the last checkpoint", async ({ page }) => {
  await startLevel(page);
  const guarded = await page.evaluate(`(() => {
    const l = (${level.toString()})();
    const lastTree = Math.max(...l.trees.map((tree) => tree.x));
    return l.bugs.getChildren().some((bug) => bug.getData("kind") === "fast" && bug.x > lastTree);
  })()`);
  expect(guarded).toBe(true);
});

// The last gap needs the dash: from the last tree, a bot that only runs and jumps loses a heart, the dashing one wins unhurt.
for (const dash of [false, true])
  test(`from the last tree, a bot ${dash ? "that dashes wins unhurt" : "that only runs and jumps is hurt"}`, async ({
    page,
  }) => {
    await startAutopilot(page, dash);
    await waitForLevel(page);
    await page.evaluate(
      `(() => { const l = (${level.toString()})(); l.player.moveTo(Math.max(...l.trees.map((t) => t.x)), 560); })()`,
    );
    const state = `(() => { const l = (${level.toString()})(); return { won: l.won, hurt: l.lives < 3 || l.gameOver }; })()`;
    await expect
      .poll(async () => {
        const { won, hurt } = (await page.evaluate(state)) as { won: boolean; hurt: boolean };
        return won || hurt;
      })
      .toBe(true);
    expect(await page.evaluate(state)).toEqual({ won: dash, hurt: !dash });
  });

// The staff's dash: X bursts the wizard forward, squishes the bug it runs into, and the kill refills it. The
// refill is read on the kill's frame, while he still dashes: once he stands again, the ground refills it anyway.
// The bug is a walking one held at speed 0, so it waits where it is put; every wait is on game state, not time.
test("the dash squishes a bug and refills itself", async ({ page }) => {
  await startLevel(page);
  const before = (await page.evaluate(`(() => {
    const l = (${level.toString()})(), p = l.player;
    const bug = l.bugs.getChildren().find((b) => b.getData("kind") === "bug");
    p.moveTo(p.body.x, p.body.y);
    bug.setData("speed", 0).setName("target");
    (${placeBug.toString()})(bug, p.sprite.x + 90, p.sprite.y - 20);
    const count = l.bugs.getChildren().length;
    const look = () => {
      if (l.bugs.getChildren().length === count) return;
      l.events.off("postupdate", look);
      window.atKill = { dashing: p.dashing, ready: p.canDash };
    };
    l.events.on("postupdate", look);
    return { x: p.body.x, bugs: count };
  })()`)) as { x: number; bugs: number };
  await page.waitForFunction(`(${level.toString()})().children.getByName("target").body.blocked.down`);
  // Held until the dash starts, as a finger does: a key that goes down and up within one frame never counts.
  await page.keyboard.down("x");
  await page.waitForFunction(`(${level.toString()})().player.dashing`);
  await page.keyboard.up("x");
  await page.waitForFunction(`!(${level.toString()})().player.dashing`);
  const after = (await page.evaluate(
    `(() => { const l = (${level.toString()})(); return { x: l.player.body.x, bugs: l.bugs.getChildren().length, atKill: window.atKill, lives: l.lives }; })()`,
  )) as { x: number; bugs: number; atKill: unknown; lives: number };
  expect(after.x - before.x).toBeGreaterThan(100);
  expect(after.bugs).toBe(before.bugs - 1);
  expect(after.atKill).toEqual({ dashing: true, ready: true });
  expect(after.lives).toBe(3);
});

// The dash refills in the air, not on the ground: X pressed every 0.35 s while running refilled on every grounded
// step and kept him at dash speed. Pressed again and again, it now goes as far as pressed once. Bugs are cleared,
// so no kill refills it; the stretch from column 60 to 77 is flat.
test("dashing again and again on the ground goes no farther than one dash", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(`(${level.toString()})().bugs.clear(true, true)`);
  const run = async (every: number) => {
    await page.evaluate(`(${level.toString()})().player.moveTo(60 * 48 + 24, 12 * 48)`);
    await page.waitForFunction(`(${level.toString()})().player.grounded`);
    return (await page.evaluate(
      `new Promise((resolve) => {
        const l = (${level.toString()})(), p = l.player, x = p.body.x;
        let start;
        const drive = (time) => {
          start ??= time;
          const t = time - start;
          p.pad.right = true;
          p.pad.dash = t % ${every} < 100;
          if (t < 900) return;
          l.events.off("update", drive);
          p.pad.right = p.pad.dash = false;
          resolve(p.body.x - x);
        };
        l.events.on("update", drive);
      })`,
    )) as number;
  };
  const once = await run(1e9);
  const spam = await run(350);
  console.log(
    `0.9 s on the ground: one dash ${once.toFixed(0)} px, a dash every 0.35 s ${spam.toFixed(0)} px`,
  );
  expect(spam).toBeLessThan(once + 24);
});

// A dash on the run-up to a gap leaves the dash in the air: refilled only on landing, the ground dash had spent it,
// and X over the gap did nothing.
test("a dash on the ground still leaves the dash in the air", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(
    `(() => { const l = (${level.toString()})(); l.bugs.clear(true, true); l.player.moveTo(60 * 48 + 24, 12 * 48); })()`,
  );
  await page.waitForFunction(`(${level.toString()})().player.grounded`);
  // Each key is held until the game has seen it: one that goes down and up within one frame never counts.
  await page.keyboard.down("x");
  await page.waitForFunction(`(${level.toString()})().player.dashing`);
  await page.keyboard.up("x");
  await page.waitForFunction(
    `!(${level.toString()})().player.dashing && (${level.toString()})().player.grounded`,
  );
  await page.keyboard.down("Space");
  await page.waitForFunction(`!(${level.toString()})().player.grounded`);
  await page.keyboard.up("Space");
  await page.keyboard.down("x");
  await page.waitForFunction(
    `(${level.toString()})().player.dashing || (${level.toString()})().player.grounded`,
  );
  await page.keyboard.up("x");
  expect(await page.evaluate(`(${level.toString()})().player.dashing`)).toBe(true);
});

// Every kind of bug walks back from a wall on its right. The first bug's platform ends in one: a wall zeroes the
// bug's velocity, and a bug that read 0 as "left" pressed against that wall for the rest of the run.
test("every bug turns at a wall on its right", async ({ page }) => {
  await startLevel(page);
  const wall = 36 * 48; // map.txt row 11: the stone after the first bug's platform
  await page.evaluate(`(() => {
    const bugs = (${level.toString()})().bugs.getChildren();
    const y = bugs.find((b) => b.getData("kind") === "bug" && b.x < ${wall}).y;
    for (const kind of ["bug", "fast", "hop"]) {
      const bug = bugs.find((b) => b.getData("kind") === kind);
      (${placeBug.toString()})(bug, ${wall} - 80, y);
      bug.setName("walled").setData("dir", 1).setVelocityX(bug.getData("speed"));
    }
  })()`);
  await page.waitForTimeout(2000);
  const xs = await page.evaluate(
    `(${level.toString()})().bugs.getChildren().filter((b) => b.name === "walled").map((b) => b.x)`,
  );
  expect(xs).toHaveLength(3);
  for (const x of xs as number[]) expect(x).toBeLessThan(wall - 80);
});

// A pit's wall is stone on stone, with no ledge inside it: the wizard who drops into a pit holding toward the
// far wall slides past every seam and loses a heart, at every pit in the level.
test("a pit wall holds no foothold", async ({ page }) => {
  test.setTimeout(60_000);
  await startLevel(page);
  // Far walls, from the level's tiles: a stone with stone below it and nothing but air below its left
  // neighbour.
  const walls = (await page.evaluate(`(() => {
    const tiles = new Set(
      (${level.toString()})().children.list
        .filter((o) => o.texture?.key === "tiles")
        .map((o) => Math.floor(o.x / 48) + "," + Math.floor(o.y / 48)),
    );
    const has = (c, r) => tiles.has(c + "," + r);
    const bottom = Math.max(...[...tiles].map((t) => +t.split(",")[1]));
    return [...tiles]
      .map((t) => t.split(",").map(Number))
      .filter(([c, r]) => !has(c, r - 1) && has(c, r + 1) && ![...Array(bottom - r + 1).keys()].some((k) => has(c - 1, r + k)));
  })()`)) as [number, number][];
  expect(walls.length).toBeGreaterThan(5);
  await page.keyboard.down("ArrowRight");
  for (const [c, r] of walls) {
    await page.evaluate(
      `(() => { const l = (${level.toString()})(); l.lives = 3; l.player.moveTo(${c * 48 - 20}, ${r * 48}); })()`,
    );
    await page.waitForFunction(`(${level.toString()})().lives < 3`, null, { timeout: 4000 });
    await page.waitForFunction(`!(${level.toString()})().player.frozen`);
  }
  await page.keyboard.up("ArrowRight");
});

// The win panel lists what each part of the run earned, the parts adding up to the score, and names the next
// rank's score and the two awards that would add the most: here the 25 crystals still out and no hits.
test("the win panel adds up the score and names the next rank and how to reach it", async ({ page }) => {
  await startLevel(page);
  // A run so far: 3 crystals, the secret, a chain of 2 (100 + 200) and one hit.
  await finish(
    page,
    "Object.assign(l, { crystals: 3, secret: true, kills: 2, longestChain: 2, score: 300, hits: 1 })",
  );
  const lines = await texts(page);
  const total = await page.evaluate(`(${level.toString()})().totalCrystals`);
  for (const line of [
    `CRYSTALS 3/${String(total)} 300`,
    "SECRET CRYSTAL 1000",
    "BUGS 2 CHAIN 2 300",
    "NO HITS -",
    "TIME 0:25 500",
    "SCORE 2100 RANK C",
    "RANK B AT 2500:",
    "CRYSTALS, NO HITS",
  ])
    expect(lines).toContain(line);
  const sum = lines.reduce((acc, line) => acc + Number(/ (\d+)$/.exec(line)?.[1] ?? 0), 0);
  expect(sum).toBe(2100);
});

// A clean, fast run that finds the secret ranks A: unhurt under the gold time with 16 crystals, the secret and 3 bugs
// (3900, which the A bar of 4000 kept B). The way on to S is exploring and chaining.
test("a clean, fast run with the secret ranks A and names the way to S", async ({ page }) => {
  await startLevel(page);
  await finish(
    page,
    "Object.assign(l, { crystals: 16, secret: true, kills: 3, longestChain: 1, score: 300, hits: 0 })",
  );
  const lines = await texts(page);
  for (const line of ["SCORE 3900 RANK A", "RANK S AT 4600:", "CRYSTALS, CHAINS"])
    expect(lines).toContain(line);
});

// Exploring beats rushing: 21 crystals, the secret, 3 bugs and one hit in 33 s outrank the unhurt run under the
// gold time that collects nothing (SCORE 1000 RANK C, the test above with the best time).
test("an exploring run outranks a rush", async ({ page }) => {
  await startLevel(page);
  await finish(
    page,
    "Object.assign(l, { crystals: 21, secret: true, kills: 3, longestChain: 1, score: 300, hits: 1, startedAt: l.time.now - 32500 })",
  );
  const text = (await texts(page)).join("|");
  expect(text).toMatch(/TIME 0:3[3-5]/);
  expect(text).toContain("SCORE 3400 RANK B");
});

// The win panel shows its lines one by one, the points counting up, so twelve lines never land at once.
test("the win panel counts up line by line", async ({ page }) => {
  await startLevel(page);
  await startFinish(page, "Object.assign(l, { crystals: 3 })");
  // Page side, every frame until the panel is done: how many lines show, the scene's clock (which the lines'
  // delays run on, so a slow frame stretches neither), and what the crystals line says.
  const seen = (await page.evaluate(
    `new Promise((resolve) => {
      const l = (${level.toString()})(), panel = l.children.getByName("panel");
      const lines = panel.list.filter((o) => o.type === "Text" && o.x === 10);
      const shown = [], crystals = new Set();
      const look = () => {
        shown.push([lines.filter((o) => o.text).length, l.time.now]);
        if (lines[2].text) crystals.add(lines[2].text.replace(/ +/g, " "));
        if (!panel.getData("done")) return;
        l.events.off("postupdate", look);
        resolve({ shown, crystals: [...crystals], total: lines.length });
      };
      l.events.on("postupdate", look);
    })`,
  )) as { shown: [number, number][]; crystals: string[]; total: number };
  // From none to all, never fewer than the frame before; a slow frame may show several lines at once, but the
  // first line and the last are a second or more apart on the scene's clock (11 lines at 150 ms).
  const counts = seen.shown.map(([n]) => n);
  const last = counts.at(-1)!;
  expect(counts[0]).toBe(0);
  expect(last).toBe(seen.total);
  expect(last).toBeGreaterThan(10);
  counts.forEach((n, i) => expect(n).toBeGreaterThanOrEqual(counts[i - 1] ?? 0));
  const when = (test: (n: number) => boolean) => seen.shown.find(([n]) => test(n))![1];
  expect(when((n) => n === last) - when((n) => n > 0)).toBeGreaterThan(1000);
  // The crystals line counts up: at least one count between none and its points shows.
  const points = seen.crystals.map((text) => Number(/ (\d+)$/.exec(text)?.[1]));
  expect(seen.crystals.at(-1)).toBe(
    `CRYSTALS 3/${String(await page.evaluate(`(${level.toString()})().totalCrystals`))} 300`,
  );
  expect(points.some((n) => n > 0 && n < 300)).toBe(true);
});

// On the win the bugs stop where they stand and fade out, so none walks through the scene.
test("the bugs fade out on the win", async ({ page }) => {
  await startLevel(page);
  await finish(page);
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(`(${level.toString()})().bugs.getChildren().filter((bug) => bug.alpha > 0).length`),
  ).toBe(0);
});

// S is in reach: the autopilot's line run unhurt under the gold time (17 crystals, the secret, 4 bugs)
// plus 5 more crystals makes 4600, rank S, and the panel names no target.
test("a gold, unhurt run with 22 crystals, the secret and 4 bugs ranks S", async ({ page }) => {
  await startLevel(page);
  await finish(
    page,
    "Object.assign(l, { crystals: 22, secret: true, kills: 4, longestChain: 1, score: 400, hits: 0 })",
  );
  const text = (await texts(page)).join("|");
  expect(text).toContain("SCORE 4600 RANK S");
  expect(text).not.toMatch(/RANK . AT/);
});

// A dash through a bug goes as far as one through the air: the hit-stop after the kill pauses the dash
// with the world instead of eating its time.
test("a dash through a bug goes as far as a dash with no bug", async ({ page }) => {
  await startLevel(page);
  const dash = async (bug: boolean) => {
    await page.evaluate(`(() => {
      const l = (${level.toString()})(), p = l.player;
      p.moveTo(300, 580);
      window.dashFrom = window.dashTo = undefined;
      let was = false;
      l.events.on("update", () => {
        if (p.dashing && !was) window.dashFrom = p.body.x;
        if (was && !p.dashing) window.dashTo = p.body.x;
        was = p.dashing;
      });
    })()`);
    await page.waitForFunction(`(${level.toString()})().player.grounded`);
    await page.waitForTimeout(300);
    if (bug)
      await page.evaluate(`(() => {
        const l = (${level.toString()})(), p = l.player, bug = l.bugs.getChildren()[0];
        (${placeBug.toString()})(bug, p.sprite.x + 90, p.sprite.y - 20);
        bug.setVelocityX(0);
      })()`);
    await page.keyboard.down("x");
    await page.waitForTimeout(50);
    await page.keyboard.up("x");
    await page.waitForFunction(`window.dashTo !== undefined`);
    return (await page.evaluate(`window.dashTo - window.dashFrom`)) as number;
  };
  const free = await dash(false);
  const through = await dash(true);
  expect(through).toBeGreaterThanOrEqual(free - 6);
});

// After a fall at the last tree, whose gap needs the dash, the controls line says how to dash again.
test("a fall at the last tree shows how to dash", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    l.player.moveTo(Math.max(...l.trees.map((t) => t.x)) + 10, 560);
  })()`);
  await page.waitForFunction(`(${level.toString()})().trees.every((tree) => tree.lit)`);
  await page.waitForTimeout(5000); // the dash line shown on the way, past the first gap, has faded
  await page.evaluate(`(${level.toString()})().player.moveTo(8000, 700)`);
  await page.waitForFunction(`(${level.toString()})().lives < 3 && !(${level.toString()})().player.frozen`);
  const help = await page.evaluate(
    `(() => { const t = (${level.toString()})().children.getByName("controls"); return [t.text, t.alpha]; })()`,
  );
  expect(help).toEqual(["X DASHES", 1]);
});

// The win panel's time is the HUD's last one: checked before the timer, the win rounded a second further when one
// ended on the win's frame. Here the run's clock jumps a second on that frame.
test("the win panel shows the time the HUD showed last", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    const jump = () => {
      if (l.won || l.player.sprite.x <= l.laptop.x - 112) return;
      l.events.off("preupdate", jump);
      l.startedAt -= 1000;
    };
    l.events.on("preupdate", jump);
    const look = () => {
      if (!l.won) return;
      l.events.off("postupdate", look);
      window.hudTime = l.timer.text;
    };
    l.events.on("postupdate", look);
  })()`);
  await finish(page);
  const hud = (await page.evaluate(`window.hudTime`)) as string;
  expect((await texts(page)).join("|")).toContain(`TIME ${hud} `);
});

// Gold is under 0:30 as the HUD shows the time: a run the HUD shows as 0:30 earns no gold, as the controls line says.
test("a run of 0:30 is not under 0:30", async ({ page }) => {
  await startLevel(page);
  await finish(page, "l.startedAt = l.time.now - 29900");
  const text = (await texts(page)).join("|");
  expect(text).toContain("TIME 0:30 -");
});

// Every hint to the next rank the panel can show fits its 20 letters a line, on lines of its own, a space after each
// comma: the line "TRY CRYSTALS,NO HITS" once dropped it to fit, and "S AT 4600, TRY" broke the sentence after "TRY".
// Each award the hint can name is open or taken in turn.
test("every rank hint fits the panel, spaced", async ({ page }) => {
  await startLevel(page);
  const hints = (await page.evaluate(`(() => {
    const l = (${level.toString()})(), hints = [];
    for (let open = 0; open < 32; open++)
      for (const chain of [0, 9]) {
        Object.assign(l, {
          crystals: open & 1 ? 0 : l.totalCrystals,
          secret: !(open & 2),
          hits: open & 4 ? 1 : 0,
          longestChain: chain,
          score: open & 16 ? 0 : 3600,
        });
        const lines = l.nextRank(!(open & 8));
        if (lines.length) hints.push(lines.map(([text]) => text));
      }
    return hints;
  })()`)) as string[][];
  expect(hints.length).toBeGreaterThan(30);
  for (const [rank, tips, ...rest] of hints) {
    expect(rest).toEqual([]);
    expect(rank).toMatch(/^RANK [SAB] AT \d+:$/);
    expect(rank.length).toBeLessThanOrEqual(20);
    expect(tips.length, tips).toBeLessThanOrEqual(20);
    expect(tips).toMatch(/^[A-Z]+( [A-Z]+)?(, [A-Z]+( [A-Z]+)?)?$/);
  }
});

/**
 * The first bug of `kind` walking right from 100 px past the door, the wizard frozen, the game stepped by hand at
 * 60 Hz: per frame its pose, its drawn top and height in art px, its facing and whether it stands.
 */
async function walkBug(page: Page, kind: string, frames: number) {
  await startLevel(page);
  return (await page.evaluate(`(() => {
    const l = (${level.toString()})(), g = window.game, bug = l.bugs.getChildren().find((b) => b.getData("kind") === "${kind}");
    l.player.frozen = true;
    (${placeBug.toString()})(bug, l.player.sprite.x + 100, 600);
    bug.setData("dir", 1).setData("nextHop", l.time.now + 900);
    g.loop.sleep();
    let t = performance.now();
    const seen = [];
    for (let i = 0; i < 60 + ${frames}; i++) {
      g.step((t += 1000 / 60), 1000 / 60);
      if (i >= 60)
        seen.push([bug.frame.name, bug.y - bug.displayHeight / 2, bug.displayHeight, bug.flipX, bug.body.blocked.down]);
    }
    g.loop.wake();
    return seen;
  })()`)) as [string, number, number, boolean, boolean][];
}

// The fast bug scuttles: a pose holds 5 frames or more, 12 poses a second at most, and it walks level. Swapping every
// 3 frames and bobbing each pose, it buzzed.
test("the fast bug scuttles, level, at 12 poses a second", async ({ page }) => {
  const seen = await walkBug(page, "fast", 60);
  const runs = seen.reduce<number[]>((acc, [pose], i) => {
    if (i && pose === seen[i - 1][0]) acc[acc.length - 1]++;
    else acc.push(1);
    return acc;
  }, []);
  expect(Math.min(...runs.slice(1, -1))).toBeGreaterThanOrEqual(5);
  // Level until it turns, where it pinches.
  const ahead = seen.slice(0, seen.findIndex(([, , , flip]) => flip !== seen[0][3]) >>> 0);
  expect(ahead.length).toBeGreaterThan(30);
  expect(ahead.map(([, top]) => top)).toEqual(ahead.map(() => seen[0][1]));
});

// A walking bug dips on each footfall and comes back up a pixel a frame: its 3 px dip snapped back in one frame.
test("a bug's footfall dip eases back", async ({ page }) => {
  const seen = await walkBug(page, "bug", 60);
  const tops = seen.map(([, top]) => top);
  expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThanOrEqual(1);
  for (let i = 1; i < seen.length; i++)
    if (seen[i][3] === seen[i - 1][3] && seen[i][4] && seen[i - 1][4])
      expect(Math.abs(tops[i] - tops[i - 1]), `frame ${i}`).toBeLessThanOrEqual(1);
});

// A hopping bug sinks into its crouch and rises out of it at most an art pixel a frame: it held a crouch of 0.8 and
// popped upright at the hop.
test("a hopping bug eases into its crouch and out of it", async ({ page }) => {
  const seen = await walkBug(page, "hop", 90);
  const heights = seen.map(([, , height]) => height);
  expect(Math.min(...heights)).toBeLessThanOrEqual(45 * 0.85);
  expect(seen.some(([, , , , down]) => !down)).toBe(true);
  for (let i = 1; i < seen.length; i++)
    if (seen[i][3] === seen[i - 1][3])
      expect(Math.abs(heights[i] - heights[i - 1]), `frame ${i}`).toBeLessThanOrEqual(1);
});

// The first crystals hang at hat height over the ground by the door: running under them collects them. His box ends
// at his shoulders, and they vanished behind the hat uncollected.
test("running under crystals at hat height collects them", async ({ page }) => {
  await startLevel(page);
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(`(${level.toString()})().player.body.x > 600`);
  await page.keyboard.up("ArrowRight");
  expect(await page.evaluate(`(${level.toString()})().crystals`)).toBe(3); // the three by the door, all before x 600
});

// His hat never draws over a plank whose top is above his feet: his box is his bottom 45 px, his frame 97 tall, and his
// hat lay across the low plank he walked under (x 3120 to 3312, 48 px over the ground's top). He passes behind it
// instead, as through a one-way plank, and stands in front of the one he lands on, his feet on its snow. He runs under
// it, then jumps up through it. A plank is its drawn pixels, ending 28 or 31 px into its tile.
test("his hat never draws over a plank above his feet", async ({ page }) => {
  await startLevel(page);
  const seen = await page.evaluate(`new Promise((done) => {
    const l = (${level.toString()})(), p = l.player, seen = { under: 0, over: 0 };
    ${bugsOff}
    const planks = l.children.list.filter((o) => o.texture?.key === "tiles" && [6, 7, 8].includes(Number(o.frame.name)));
    const look = () => {
      const s = p.sprite.getBounds();
      for (const o of planks) {
        const t = { x: o.x - 24, y: o.y - 24, right: o.x + 24, bottom: o.y - 24 + (Number(o.frame.name) === 7 ? 28 : 31) };
        if (p.body.bottom <= o.y - 20 || t.right <= s.x || s.right <= t.x || s.y >= t.bottom || t.y >= s.bottom) continue;
        seen.under++;
        if (o.depth <= p.sprite.depth) seen.over++;
      }
    };
    l.game.events.on("postrender", look);
    p.moveTo(3000, 600);
    l.time.delayedCall(300, () => (p.pad.right = true));
    l.time.delayedCall(1500, () => {
      p.pad.right = false;
      p.moveTo(3240, 600);
    });
    l.time.delayedCall(1800, () => (p.pad.jump = true));
    l.time.delayedCall(2300, () => (p.pad.jump = false));
    l.time.delayedCall(3000, () => {
      l.game.events.off("postrender", look);
      const plank = planks.find((o) => Math.abs(o.x - p.body.center.x) <= 24 && o.y - 20 === p.body.bottom);
      done({ ...seen, onPlank: p.grounded && plank?.depth < p.sprite.depth });
    });
  })`);
  // He went under the plank, his frame reaching into it, and ended standing on it, drawn in front of it.
  expect((seen as { under: number }).under).toBeGreaterThan(10);
  expect(seen).toMatchObject({ over: 0, onPlank: true });
});

// Held against a wall he stands instead of running in place.
test("pushing against a wall shows him standing", async ({ page }) => {
  await startLevel(page);
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(`(${level.toString()})().player.body.blocked.right`);
  await page.waitForTimeout(300);
  const seen = await page.evaluate(`(() => {
    const p = (${level.toString()})().player;
    return [p.body.blocked.right, p.sprite.anims.currentAnim.key];
  })()`);
  await page.keyboard.up("ArrowRight");
  expect(seen).toEqual([true, "idle"]);
});

// A dash pressed and released between two frames still dashes: the key's up cleared the press before he read it.
test("a dash tapped within one frame still dashes", async ({ page }) => {
  await startLevel(page);
  await page.waitForFunction(`(${level.toString()})().player.grounded`);
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    window.dashed = false;
    l.events.on("update", () => (window.dashed ||= l.player.dashing));
    window.game.loop.sleep();
  })()`);
  await page.keyboard.down("x");
  await page.keyboard.up("x");
  await page.evaluate(() => window.game.loop.wake());
  await page.waitForTimeout(300);
  expect(await page.evaluate(`window.dashed`)).toBe(true);
});

// The win panel at every size: its lines 2 font px apart or more (1 px read as a wall), the points right-aligned two
// letters clear of their labels, a missed part a dash, "NEW BEST" once, all inside the panel above the footer; upright,
// in the band above the canvas, each line on one line, 4 CSS px or more apart and 16 px or more from the screen's top:
// at 320x568 it started 8 px from the top, 2.8 px between lines. The run has 12 lines: a hit and the
// hint to the next rank. On the canvas the panel stays 16 px or more clear of his frame in every frame drawn, in view
// pixels: at 1920x1080 his scarf lay on its border where he stopped.
for (const [width, height] of [
  [1920, 1080],
  [1280, 720],
  [844, 390],
  [390, 844],
  [320, 568],
])
  test(`the win panel is spaced and fits at ${width}x${height}`, async ({ browser }) => {
    const touch = width < 1000;
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    await startLevel(page, touch);
    await page.evaluate(`(() => {
      const l = (${level.toString()})();
      window.near = { shown: 0, close: 0 };
      l.game.events.on("postrender", () => {
        const panel = l.children.getByName("panel");
        if (!panel?.visible) return;
        const r = panel.list[0].getBounds(), edge = (panel.list[0].lineWidth * panel.scaleX) / 2 + 16;
        const s = l.player.sprite.getBounds(), v = l.cameras.main.worldView;
        window.near.shown++;
        if (s.x - v.x < r.right + edge && r.x - edge < s.right - v.x && s.y - v.y < r.bottom + edge && r.y - edge < s.bottom - v.y)
          window.near.close++;
      });
    })()`);
    await finish(
      page,
      "Object.assign(l, { crystals: 18, secret: true, kills: 3, longestChain: 1, score: 300, hits: 1 })",
    );
    await page.waitForTimeout(1000); // the fountain's last sparks and the view at rest
    const near = (await page.evaluate("window.near")) as { shown: number; close: number };
    expect(near.close).toBe(0);
    expect(near.shown > 0).toBe(width > height);
    const lines = (await page.evaluate(`(() => {
      const panel = (${level.toString()})().children.getByName("panel");
      return panel.list.filter((o) => o.type === "Text" && o.x === 10).map((o) => [o.text, o.y, o.width]);
    })()`)) as [string, number, number][];
    const rect = (await page.evaluate(
      `(() => { const r = (${level.toString()})().children.getByName("panel").list[0]; return r.y + r.height; })()`,
    )) as number;
    expect(lines.length).toBe(12);
    expect(rect).toBeLessThanOrEqual(134); // the footer's top
    lines.forEach(([, y, w], i) => {
      expect(w).toBeLessThanOrEqual(160);
      if (i) expect(y - lines[i - 1][1]).toBeGreaterThanOrEqual(10);
    });
    const awards = lines.slice(2, 7).map(([text]) => text);
    for (const text of awards) expect(text).toMatch(/^.{1,14}\S {2,}(\d+|-)$/);
    expect(awards).toContain(`NO HITS${" ".repeat(12)}-`);
    // A chain of one is no chain: "BUGS 3 CHAIN 1" read as a second count.
    expect(awards).toContain(`BUGS 3${" ".repeat(11)}300`);
    expect(lines.filter(([text]) => text.includes("NEW BEST")).length).toBeLessThanOrEqual(1);
    expect(lines.map(([text]) => text).join("|")).not.toMatch(/NEW BEST.*NEW BEST/);
    if (height > width) {
      const band = await page.evaluate(() => {
        const above = document.getElementById("above")!;
        const leading = parseFloat(getComputedStyle(above).lineHeight);
        return {
          top: above.getBoundingClientRect().top,
          bottom: above.getBoundingClientRect().bottom,
          canvas: document.querySelector("canvas")!.getBoundingClientRect().top,
          leading,
          tallest: Math.max(...[...above.children].map((line) => line.getBoundingClientRect().height)),
          size: parseFloat(getComputedStyle(above).fontSize),
        };
      });
      expect(band.top).toBeGreaterThanOrEqual(16);
      expect(band.bottom).toBeLessThanOrEqual(band.canvas);
      expect(band.leading - band.size).toBeGreaterThanOrEqual(4);
      expect(band.tallest).toBeLessThanOrEqual(band.leading + 1);
      // The best and the tap to play again lead the band below, where the panel above had no room for them.
      const below = await page.evaluate(() => {
        const below = document.getElementById("below")!;
        return { text: below.innerText, bottom: below.getBoundingClientRect().bottom };
      });
      expect(below.text).toMatch(/^(NEW )?BEST .*\n+TAP TO PLAY AGAIN\n/);
      expect(below.bottom).toBeLessThanOrEqual(height);
    }
    await page.close();
  });

// The high route ends above the last tree's strip (top 624). Off its old end at x 7488, a running jump came down past
// the strip's right end, then 7776, at y 555 and fell into the last gap. Bugs are off: the hopping one up there hurt
// him first. He jumps on the last step with ground under his front edge.
test("a running jump off the high route's end lands on the last tree's strip", async ({ page }) => {
  await startLevel(page);
  const landing = await page.evaluate(`new Promise((done) => {
    const l = (${level.toString()})(), p = l.player;
    p.moveTo(7300, 200);
    ${bugsOff}
    let jumped = false;
    l.events.on("update", () => {
      const b = p.body;
      p.pad.right = true;
      if (p.grounded && b.y < 300 && !l.physics.overlapRect(b.right, b.bottom + 2, 6, 4, false, true).length)
        jumped = p.pad.jump = true;
      else if (jumped && p.grounded && b.velocity.y >= 0 && b.y > 300) done({ bottom: b.bottom, lives: l.lives });
      if (l.lives < 3) done({ bottom: b.bottom, lives: l.lives });
    });
  })`);
  expect(landing).toEqual({ bottom: 624, lives: 3 });
});
