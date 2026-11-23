import { expect, test, type Page } from "@playwright/test";
import { clock, level, startLevel, tapper } from "./game";

// Three falls into a pit cost three lives and show GAME OVER; a fresh press brings the level back.
// Page-side expressions: lives, game over and whether the wizard is frozen; the play controls left.
const state = `(() => { const l = (${level.toString()})(); return { lives: l.lives, gameOver: l.gameOver, frozen: l.player.frozen }; })()`;
const controls = `(${level.toString()})().children.list.filter((c) => c.name === "controls").length`;
const fall = (page: Page) => page.evaluate(`(${level.toString()})().player.moveTo(24 * 48 + 24, 600)`);

test("losing every life shows GAME OVER; held Enter does not restart, a new press does", async ({ page }) => {
  await startLevel(page);

  for (const lives of [2, 1, 0]) {
    // Hold Enter through the last fall, as a player mashing it would.
    if (!lives) await page.keyboard.down("Enter");
    await fall(page);
    await expect.poll(() => page.evaluate(state)).toMatchObject({ lives });
    if (lives) await page.waitForFunction(`!(${level.toString()})().player.frozen`);
  }
  await expect.poll(() => page.evaluate(`${state}.gameOver`)).toBe(true);

  // Keyboard auto-repeat: Playwright sends a repeat keydown for each down() on a held key.
  for (let i = 0; i < 40; i++) {
    await page.keyboard.down("Enter");
    await page.waitForTimeout(50);
  }
  expect(await page.evaluate(state)).toMatchObject({ lives: 0, gameOver: true });

  await page.keyboard.up("Enter");
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(state)).toMatchObject({ lives: 3, gameOver: false });
  expect(await page.evaluate(`(${level.toString()})().crystals`)).toBe(0);
});

// An Enter right as GAME OVER shows restarts: it was lost for 1.2 s, so the player had to press again.
test("a fresh Enter the moment GAME OVER shows restarts", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(`(${level.toString()})().lives = 1`);
  await fall(page);
  await page.waitForFunction(`${state}.gameOver`, undefined, { polling: "raf" });
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(state)).toMatchObject({ lives: 3, gameOver: false });
});

test.describe("on a phone", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

  test("GAME OVER hides the touch pad; a touch held while dying does not restart, a tap at once does", async ({
    page,
  }) => {
    await startLevel(page, true);
    const tap = await tapper(page);
    expect(await page.evaluate(controls)).toBeGreaterThan(0);

    // A thumb held on the canvas through the last fall, lifted once GAME OVER shows, restarts nothing.
    const cdp = await page.context().newCDPSession(page);
    const canvas = (await page.locator("canvas").boundingBox())!;
    const point = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 };
    await page.evaluate(`(${level.toString()})().lives = 1`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await fall(page);
    await expect.poll(() => page.evaluate(`${state}.gameOver`)).toBe(true);
    expect(await page.evaluate(controls)).toBe(0);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);
    expect(await page.evaluate(state)).toMatchObject({ lives: 0, gameOver: true });

    await tap(480, 270);
    await expect.poll(() => page.evaluate(state)).toMatchObject({ lives: 3, gameOver: false });
  });
});

// A hit flashes the wizard and the emptied heart, never the whole screen.
test("a hit flashes no full-screen wash", async ({ page }) => {
  await startLevel(page);
  const flashing = await page.evaluate(
    `(() => { const l = (${level.toString()})(); l.invulnerableUntil = 0; l.hurt(false, 1); return l.cameras.main.flashEffect.isRunning; })()`,
  );
  expect(flashing).toBe(false);
});

// The hearts sit right after the crystal count, so the HUD bar shows no wide gap.
test("the HUD hearts follow the crystal count", async ({ page }) => {
  await startLevel(page);
  const gap = await page.evaluate(
    `(() => { const l = (${level.toString()})(); return l.hearts[0].getLeftCenter().x - l.hud.getRightCenter().x; })()`,
  );
  expect(gap).toBeLessThan(40);
});

// A second hit while he still blinks (a fall always counts) overlaps two blinks; he still ends fully solid.
test("the wizard ends solid after overlapping respawn blinks", async ({ page }) => {
  await startLevel(page);
  const hit = `(() => { const l = (${level.toString()})(); l.invulnerableUntil = 0; l.hurt(false, 1); })()`;
  await page.evaluate(hit);
  await page.waitForTimeout(900);
  await page.evaluate(hit);
  await page.waitForTimeout(1800);
  expect(await page.evaluate(`(${level.toString()})().player.sprite.alpha`)).toBe(1);
});

// A hit just before the finish line, at dash speed, slides him over it while frozen: the win stands, with no
// GAME OVER on top and no return to the last tree.
test("a hit just before the finish still wins", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    l.lives = 1;
    l.player.moveTo(8110, l.laptop.y - 60);
  })()`);
  await page.waitForFunction(`(${level.toString()})().player.grounded`);
  await page.evaluate(
    `(() => { const l = (${level.toString()})(); l.player.body.setVelocityX(975); l.hurt(); })()`,
  );
  await page.waitForTimeout(1000);
  const state = await page.evaluate(
    `(() => { const l = (${level.toString()})(); return { won: l.won, gameOver: l.gameOver, past: l.player.sprite.x > 8100 }; })()`,
  );
  expect(state).toEqual({ won: true, gameOver: false, past: true });
});

// A fall into the first pit sends him back to the door through a cut: the world fades to the night and back while the
// camera jumps there unseen. It panned about 1000 px in a quarter second, while he could already be steered off screen.
// Each frame drawn from the fall until 60 frames after he moves again: the camera moves at most 16.5 world px (the
// eased step's cap and rounding) on any frame the world shows through the fade, and wherever input counts he is in the
// view, the fade gone. With reduced motion a plain cut: one frame moves farther, and he moves again at once.
for (const reduced of [false, true])
  test(`a respawn ${reduced ? "with reduced motion cuts" : "fades out, cuts and fades in"}, the input held until he shows`, async ({
    page,
  }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(clock, 60);
    await startLevel(page);
    await page.evaluate(`(${level.toString()})().player.moveTo(22 * 48, 500)`); // by the pit, the camera coming over first
    await page.waitForTimeout(2000);
    const seen = (await page.evaluate(`new Promise((done) => {
      const l = (${level.toString()})(), p = l.player, cam = l.cameras.main;
      p.moveTo(24 * 48 + 24, 600);
      const seen = { far: 0, farLit: 0, steerable: 0, unseen: 0, x: 0 };
      let [last, hurt, after] = [undefined, false, 0];
      window.game.events.on("postrender", () => {
        const [v, s, dark] = [cam.worldView, p.sprite.getBounds(), cam.fadeEffect.alpha];
        hurt ||= p.hit;
        if (hurt && last) {
          const far = Math.max(Math.abs(cam.scrollX - last[0]), Math.abs(cam.scrollY - last[1])) > 16.5;
          seen.far += far;
          seen.farLit += far && dark < 1;
          if (!p.frozen) {
            seen.steerable++;
            seen.unseen += dark > 0 || s.x < v.x || s.right > v.right || s.y < v.y || s.bottom > v.bottom;
            if (++after > 60) done({ ...seen, x: Math.round(p.body.center.x) });
          }
        }
        last = [cam.scrollX, cam.scrollY];
      });
    })`)) as Record<string, number>;
    expect(seen).toEqual({ far: 1, farLit: reduced ? 1 : 0, steerable: 61, unseen: 0, x: seen.x });
    expect(seen.x).toBeLessThan(400);
  });

// The second of invulnerability after a fall starts when he moves again: started at the cut, the fade-in's 180 ms and
// the frames before it ate into it while he stood frozen. With reduced motion the cut gives control back at once.
for (const reduced of [false, true])
  test(`after a respawn${reduced ? " with reduced motion" : ""} he is invulnerable a full second once he moves`, async ({
    page,
  }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(clock, 60);
    await startLevel(page);
    const left = (await page.evaluate(`new Promise((done) => {
      const l = (${level.toString()})(), p = l.player;
      p.moveTo(24 * 48 + 24, 600);
      let hurt = false;
      window.game.events.on("postrender", () => {
        hurt ||= p.hit;
        if (hurt && !p.frozen) done(l.invulnerableUntil - l.time.now);
      });
    })`)) as number;
    expect(Math.round(left)).toBeGreaterThanOrEqual(Math.round(1000 - 1000 / 60)); // at most the frame it unlocks in
  });

// A hit's spin keeps him fully seen through its first half and fades him in its second: faded over the whole spin, he
// was mostly gone while he spun. With reduced motion he fades over the whole of it. Every frame drawn while the spin
// runs: his alpha against the spin's progress.
for (const reduced of [false, true])
  test(`the hit's fade${reduced ? " with reduced motion" : ""} ${reduced ? "runs with" : "waits for half"} the spin`, async ({
    page,
  }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(clock, 60);
    await startLevel(page);
    await page.waitForFunction(`(${level.toString()})().player.grounded`);
    const curve = (await page.evaluate(`new Promise((done) => {
      const l = (${level.toString()})(), p = l.player, curve = [];
      const look = () => {
        const spin = l.tweens.getTweensOf(p.sprite).find((t) => t.data[0].key === "angle");
        if (spin) curve.push([spin.data[0].progress, p.sprite.alpha]);
        else if (curve.length) {
          l.game.events.off("postrender", look);
          done(curve);
        }
      };
      l.game.events.on("postrender", look);
      l.hurt(false, 1);
    })`)) as [number, number][];
    const [first, second] = [curve.filter(([t]) => t < 0.5), curve.filter(([t]) => t > 0.5)];
    expect(first.length).toBeGreaterThan(5);
    expect(second.length).toBeGreaterThan(5);
    // Within 0.15 of the straight fade: a delayed tween starts a frame late, and a frame of the fade is 0.095. The
    // spin and his alpha are read in the same frame.
    if (reduced) for (const [t, a] of curve) expect(a).toBeLessThanOrEqual(1 - t + 0.15);
    else {
      expect(first.every(([, a]) => a === 1)).toBe(true);
      for (const [t, a] of second) expect(a).toBeLessThanOrEqual(2 * (1 - t) + 0.15);
    }
    for (let i = 1; i < second.length; i++) expect(second[i][1]).toBeLessThanOrEqual(second[i - 1][1]);
  });

// A hit spins him about his middle, his turned frame never below the ground he stood on: turned about his feet, he
// went into the stone floor, and on a 667x375 phone 37 px into the right touch button for 5 frames.
test("the hit's spin stays above the ground", async ({ page }) => {
  await startLevel(page);
  await page.waitForFunction(`(${level.toString()})().player.grounded`);
  const seen = (await page.evaluate(`new Promise((done) => {
    const l = (${level.toString()})(), p = l.player, ground = p.body.bottom, seen = { ground, lowest: -Infinity, turned: 0 };
    const look = () => {
      if (!p.hit) return;
      if (p.sprite.angle) seen.turned++;
      seen.lowest = Math.max(seen.lowest, p.sprite.getBounds().bottom);
    };
    l.game.events.on("postrender", look);
    l.hurt(false, 1);
    l.time.delayedCall(400, () => {
      l.game.events.off("postrender", look);
      done(seen);
    });
  })`)) as { ground: number; lowest: number; turned: number };
  expect(seen.turned).toBeGreaterThan(5);
  expect(seen.lowest).toBeLessThanOrEqual(seen.ground);
});
