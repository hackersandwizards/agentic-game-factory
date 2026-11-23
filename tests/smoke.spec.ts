import { expect, test } from "@playwright/test";
import type Phaser from "phaser";
import { colors } from "../brand.json";
import {
  bugsOff,
  clock,
  level,
  openTitle,
  placeBug,
  shoot,
  startAutopilot,
  startLevel,
  waitForLevel,
  watchLines,
} from "./game";

test("the example's title waits for Start", async ({ page }) => {
  await page.goto("/examples/present/");
  const active = (key: string) => page.evaluate((k) => !!window.game?.scene.isActive(k), key);
  await expect.poll(() => active("title")).toBe(true);
  await page.waitForTimeout(5000);
  expect(await active("title")).toBe(true);
  expect(await active("level")).toBe(false);
  await page.keyboard.press("Enter");
  await expect.poll(() => active("level"), { timeout: 5000 }).toBe(true);
});

// The title draws the video's full-size picture over the whole canvas. Alignment: the screen and the source
// picture, both scaled to 80x45 (4x4 title pixels a cell), agree cell by cell across the band at title
// y 88..140, which no overlay touches.
test("the title's full-size picture fills the canvas, aligned", async ({ page }) => {
  await openTitle(page);
  await shoot(page);
  const diff = await page.evaluate(() => {
    // Each cell's mean colour, rows 22..34 of 45, from the image at its own size.
    const cells = ({ width: w, height: h, data: d }: ImageData) => {
      const sum = new Float64Array(80 * 13 * 4);
      for (let y = Math.ceil((22 * h) / 45); y < (35 * h) / 45; y++)
        for (let x = 0; x < w; x++) {
          const c = ((Math.floor((y * 45) / h) - 22) * 80 + Math.floor((x * 80) / w)) * 4;
          for (let k = 0; k < 3; k++) sum[c + k] += d[(y * w + x) * 4 + k];
          sum[c + 3]++;
        }
      for (let c = 0; c < sum.length; c += 4) for (let k = 0; k < 3; k++) sum[c + k] /= sum[c + 3];
      return sum;
    };
    // The loaded picture itself: the loader's blob URL is gone once it is decoded.
    const pic = window.game.textures.get("workshop").getSourceImage() as HTMLImageElement;
    const ctx = new OffscreenCanvas(pic.width, pic.height).getContext("2d")!;
    ctx.drawImage(pic, 0, 0);
    const [a, b] = [cells(window.shot), cells(ctx.getImageData(0, 0, pic.width, pic.height))];
    let sum = 0;
    for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) sum += Math.abs(a[i + k] - b[i + k]);
    return sum / ((a.length / 4) * 3);
  });
  console.log(`title picture: mean cell difference ${diff.toFixed(1)}`);
  expect(diff).toBeLessThan(6);
});

// A player whose system asks for less motion gets a fade from the title, not the flight through the door.
test("with reduced motion, Start fades instead of zooming", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTitle(page);
  const zooms = page.evaluate(
    () =>
      new Promise<[number, number]>((resolve) => {
        const cam = window.game.scene.getScene("title").cameras.main;
        const start = cam.zoom;
        let most = start;
        const tick = () => {
          most = Math.max(most, cam.zoom);
          if (window.game.scene.isActive("level")) resolve([start, most]);
          else requestAnimationFrame(tick);
        };
        tick();
      }),
  );
  await page.keyboard.press("Enter");
  const [start, most] = await zooms;
  expect(most).toBe(start);
});

// With reduced motion, nothing in the level blinks, bobs or pulses for ever: not the neon sign, the terminal's
// cursor, the d20 or the staff's glow.
test("with reduced motion, the level runs no endless loop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await startLevel(page);
  const loops = await page.evaluate(
    `(${level.toString()})().tweens.getTweens().filter((t) => t.data.some((d) => d.repeat === -1)).length`,
  );
  expect(loops).toBe(0);
  const glow = () => page.evaluate(`(${level.toString()})().player.glow.alpha`);
  const first = await glow();
  await page.waitForTimeout(300);
  expect(await glow()).toBe(first);
});

// The staff's glow on the title is the film's: 6 px in radius on the 320x180 picture, pulsing to 7.2.
test("the title's staff glow matches the film", async ({ page }) => {
  await openTitle(page);
  const widths = await page.evaluate(() =>
    window.game.scene
      .getScene("title")
      .children.list.filter(
        (o) =>
          (o as Phaser.GameObjects.Image).texture?.key === "glow" &&
          (o as Phaser.GameObjects.Image).tintTopLeft === 0x2dd4bf,
      )
      .map((o) => (o as Phaser.GameObjects.Image).displayWidth),
  );
  expect(widths.length).toBe(1);
  expect(widths[0]).toBeLessThanOrEqual(15);
});

// Under the horizon the night is solid: a pit shows no sky and no stars between the ground and the foreground.
test("a pit shows solid night below the horizon", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await startLevel(page);
  // The wizard stands on the pillar at columns 121-122; columns 123-125 are a pit.
  await page.evaluate(`(${level.toString()})().player.moveTo(122 * 48, 12 * 48)`);
  await page.waitForTimeout(1500);
  // Snow, sparkles and the foreground pass in front of the pit: hidden, with the scene paused, every run
  // measures the same pixels.
  const box = await page.evaluate(`(() => {
    const l = (${level.toString()})();
    l.children.list.forEach((o) => o.type === "ParticleEmitter" && o.setVisible(false));
    l.foreground.setVisible(false);
    l.scene.pause();
    const view = l.cameras.main.worldView, zoom = l.cameras.main.zoom;
    // Columns 123-125 between the pillars, from the bottom of the horizon fade to the bottom of the screen,
    // inset 4 px. The fade is screen-fixed: on the zoomed camera its 0 lies 270 px up.
    const top = (l.fade.y + 48 - 270) * zoom + 4, bottom = l.cameras.main.height - 4;
    return [(123 * 48 - view.x) * zoom + 4, top, 3 * 48 * zoom - 8, bottom - top].map(Math.round);
  })()`);
  await page.waitForTimeout(100);
  await shoot(page);
  const lit = await page.evaluate(([x, y, w, h]) => {
    const { width, data } = window.shot;
    let count = 0;
    for (let row = y; row < y + h; row++)
      for (let i = (row * width + x) * 4; i < (row * width + x + w) * 4; i += 4)
        if (data[i] + data[i + 1] + data[i + 2] > 60) count++;
    return count;
  }, box as number[]);
  expect((box as number[])[3]).toBeGreaterThan(40);
  expect(lit).toBe(0);
});

// High on the last stretch the ground line is below the view, and the forest and firs filling its bottom read as
// ground under the pits: there the view's bottom sinks into solid night behind the platforms.
test("high above a pit, the view's bottom fades into the night", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await startLevel(page);
  // On the high route at columns 151-155 (map.txt row 5), over the pit at columns 140-157.
  await page.evaluate(
    `(() => { const l = (${level.toString()})(); l.invulnerableUntil = 1e12; l.player.moveTo(152 * 48, 200); })()`,
  );
  await page.waitForTimeout(2500);
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    l.children.list.forEach((o) => o.type === "ParticleEmitter" && o.setVisible(false));
    l.scene.pause();
  })()`);
  await page.waitForTimeout(100);
  await shoot(page);
  // The bottom 20 art pixels, left of the last tree's star, which stands in the pit at column 161.
  const lit = await page.evaluate(() => {
    const { width, height, data } = window.shot;
    let count = 0;
    for (let row = height - 40; row < height; row++)
      for (let i = row * width * 4; i < (row * width + 1300) * 4; i += 4)
        if (data[i] + data[i + 1] + data[i + 2] > 60) count++;
    return count;
  });
  expect(lit).toBe(0);
});

// The film ends on the staff's soft glow: the title holds its sparkles back for 0.6 s and fades them in.
test("the title's staff sparkles join after the film's last frame", async ({ page }) => {
  await openTitle(page);
  const sparkles = () =>
    page.evaluate(() => {
      const emitter = window.game.scene
        .getScene("title")
        .children.list.find(
          (o) =>
            o.type === "ParticleEmitter" && (o as Phaser.GameObjects.Particles.ParticleEmitter).x === 163,
        ) as Phaser.GameObjects.Particles.ParticleEmitter;
      return { alive: emitter.getAliveParticleCount(), alpha: emitter.alpha };
    });
  expect(await sparkles()).toEqual({ alive: 0, alpha: 0 });
  await page.waitForTimeout(1600);
  const later = await sparkles();
  expect(later.alive).toBeGreaterThan(0);
  expect(later.alpha).toBe(1);
});

// The desktop title's bottom line is short enough to leave the 18+ chip room.
test("the desktop title says ENTER OR TAP TO START", async ({ page }) => {
  await openTitle(page);
  expect(await page.evaluate(() => window.game.textures.exists("strip-ENTER OR TAP TO START"))).toBe(true);
});

// The film never shows the 18+ chip or the speaker: they stay invisible on its last frame and fade in after.
test("the title's switches fade in after the film's last frame", async ({ page }) => {
  await openTitle(page);
  const alphas = () =>
    page.evaluate(() =>
      ["gore", "speaker"].map(
        (name) =>
          (window.game.scene.getScene("title").children.getByName(name) as Phaser.GameObjects.Image).alpha,
      ),
    );
  for (const alpha of await alphas()) expect(alpha).toBeLessThan(0.01);
  await page.waitForTimeout(1600);
  expect(await alphas()).toEqual([1, 1]);
});

// The autopilot's jump off the planks above the "42" sign rises past the level's top: the camera follows the
// wizard up there, so his head never leaves the view.
test("the camera keeps the wizard's head in view on the highest jump", async ({ page }) => {
  test.setTimeout(60_000);
  await startAutopilot(page);
  // The lowest the head gets above the view's top edge, in world pixels, as each frame is drawn.
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    window.headroom = Infinity;
    window.game.events.on("postrender", () => {
      const s = l.player.sprite;
      window.headroom = Math.min(window.headroom, s.y - s.displayHeight - l.cameras.main.worldView.y);
    });
  })()`);
  await page.waitForFunction(`(${level.toString()})().player.sprite.x > 4700`, null, { timeout: 40_000 });
  expect(
    await page.evaluate(() => (window as unknown as { headroom: number }).headroom),
  ).toBeGreaterThanOrEqual(0);
});

// Where the limit his head sets jumps without him moving, the camera eases up, no faster than twice his jump speed:
// as the phone turned sideways the canvas HUD took 56 px above his head at once, and the camera jumped up 56 px in one
// frame. Upright, he is lifted 300 px with the world paused, so the camera holds his head at the view's top; turned
// sideways, the camera's step is read every frame against that pace (plus 2 px of rounding).
test("the camera eases up when the HUD turns on above his head", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await startLevel(page);
  await page.waitForFunction(`(${level.toString()})().player.grounded`);
  await page.evaluate(`(() => {
    const l = (${level.toString()})(), p = l.player;
    l.physics.world.pause();
    p.moveTo(p.body.center.x, p.body.center.y - 300);
  })()`);
  const frame = await page.evaluate(() => window.game.loop.frame);
  await page.waitForFunction((frame) => window.game.loop.frame > frame + 30, frame);
  const steps = page.evaluate(`new Promise((resolve) => {
    const cam = (${level.toString()})().cameras.main;
    let [last, frames, over] = [cam.scrollY, 0, []];
    const look = () => {
      const pace = (2 * window.FEEL.jumpSpeed * Math.min(window.game.loop.delta, 50)) / 1000 + 2;
      if (last - cam.scrollY > pace) over.push(last - cam.scrollY);
      last = cam.scrollY;
      if (++frames < 60) return;
      window.game.events.off("postrender", look);
      resolve(over);
    };
    window.game.events.on("postrender", look);
  })`);
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(await steps).toEqual([]);
});

// Turned sideways mid-run, the canvas shows the controls line again: upright it showed only in the band below the
// canvas, which CSS hides sideways, so the hint showed nowhere.
test("the controls line shows on the canvas after turning sideways", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await startLevel(page);
  const visible = `(${level.toString()})().children.getByName("controls").visible`;
  expect(await page.evaluate(visible)).toBe(false);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForFunction(visible, null, { timeout: 5000 });
});

// Off the high platform before the laptop, the camera leads the fall: the pillar he lands on shows before
// he reaches it.
test("the camera shows the landing on a long drop", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(
    `(() => { const l = (${level.toString()})(); l.invulnerableUntil = 1e12; l.player.moveTo(7300, 200); })()`,
  );
  await page.waitForFunction(`(${level.toString()})().player.grounded`);
  await page.waitForTimeout(500);
  // The view's bottom edge each time a frame is drawn while his feet pass y 480, 144 px above the pillar.
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    window.bottoms = [];
    window.game.events.on("postrender", () => {
      const y = l.player.sprite.y;
      if (y > 450 && y < 520 && l.player.body.velocity.y > 0) window.bottoms.push(l.cameras.main.worldView.bottom);
    });
  })()`);
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(
    `window.bottoms.length > 0 && (${level.toString()})().player.sprite.y > 520`,
    null,
    {
      timeout: 5000,
    },
  );
  await page.keyboard.up("ArrowRight");
  const bottoms = (await page.evaluate(`window.bottoms`)) as number[];
  expect(Math.min(...bottoms)).toBeGreaterThanOrEqual(624 + 48);
});

// Sideways on a phone, walking off a high ledge, the landing shows above the touch pad 15 frames into the fall, as soon
// as the HUD lets his head go: aimed at the pad's edge instead of 48 px above it, the eased view crept there for 27.
// Off the first high route and the second (map.txt row 5), every frame drawn: the landing's top above the pad's room.
test("sideways on a phone, off a high ledge the landing shows within 16 frames", async ({ browser }) => {
  const page = await browser.newPage({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  await page.addInitScript(clock, 60);
  await startLevel(page, true);
  for (const column of [80, 152]) {
    await page.evaluate(`(() => {
        const l = (${level.toString()})();
        l.invulnerableUntil = 1e12;
        ${bugsOff}
        l.player.moveTo(${column} * 48, 200);
      })()`);
    await page.waitForFunction(`(${level.toString()})().player.grounded`);
    await page.waitForTimeout(600);
    const late = await page.evaluate(`new Promise((done) => {
        const l = (${level.toString()})(), p = l.player;
        const run = () => (p.pad.right = true);
        let off = -1;
        const look = () => {
          if (off < 0 && !p.grounded) off = 0;
          if (off < 0) return;
          if (l.cameras.main.worldView.bottom - l.padRoom > 624 || off > 60) {
            l.physics.world.off("worldstep", run);
            window.game.events.off("postrender", look);
            p.pad.right = false;
            done(off);
          }
          off++;
        };
        l.physics.world.on("worldstep", run);
        window.game.events.on("postrender", look);
      })`);
    console.log(`column ${column}: the landing shows ${String(late)} frames after the edge`);
    expect(late).toBeLessThanOrEqual(16);
  }
  await page.close();
});

// Dashes the wizard through two bugs set in his way, a chain of 2.
async function dashTwoBugs(page: import("@playwright/test").Page) {
  const before = await page.evaluate(`(() => {
    const l = (${level.toString()})(), p = l.player, [a, b] = l.bugs.getChildren();
    p.moveTo(p.body.x, p.body.y);
    for (const [bug, dx] of [[a, 70], [b, 110]]) { (${placeBug.toString()})(bug, p.sprite.x + dx, p.sprite.y - 20); bug.setVelocityX(0); }
    return l.bugs.getChildren().length;
  })()`);
  await page.waitForTimeout(300);
  await page.keyboard.down("x");
  await page.waitForTimeout(50);
  await page.keyboard.up("x");
  await page.waitForFunction(
    `(${level.toString()})().bugs.getChildren().length === ${String(before)} - 2`,
    null,
    {
      timeout: 2000,
    },
  );
}

// A hit and every kill, a dash's included, shake the world camera, and every shake dies down. Each shake reads its own
// intensity 4 frames of the running world after it starts (a hit-stop holds its easing too), unless the next shake
// replaced it first: read by wall time into the list's last entry, a hit that started within that time wrote over the
// chain's entry.
test("a hit and a chain shake the camera, easing out", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})(), cam = l.cameras.main;
    window.shakes = [];
    cam.on("camerashakestart", () => {
      const shake = { chain: l.chain, start: cam.shakeEffect.intensity.x };
      window.shakes.push(shake);
      let frames = 0;
      const look = () => {
        if (window.shakes.at(-1) !== shake) shake.later = null;
        else if (l.physics.world.isPaused || ++frames < 4) return;
        else shake.later = cam.shakeEffect.intensity.x;
        l.events.off("postupdate", look);
      };
      l.events.on("postupdate", look);
    });
  })()`);
  const read = (count: number) =>
    page.waitForFunction(
      `window.shakes.length === ${count} && window.shakes.every((s) => s.later !== undefined)`,
    );
  await dashTwoBugs(page);
  // The hit comes once he has landed, the chain is over and its shake was read, since a new shake replaces it.
  await page.waitForFunction(`(${level.toString()})().chain === 0`);
  await read(2);
  await page.evaluate(`(${level.toString()})().hurt()`);
  await read(3);
  const shakes = (await page.evaluate(`window.shakes`)) as {
    chain: number;
    start: number;
    later: number | null;
  }[];
  // One for each kill, one for the hit; the chain's second kill and the hit are read in full.
  expect(shakes.map((shake) => shake.chain)).toEqual([1, 2, 0]);
  expect(shakes.slice(1).every((shake) => shake.later !== null)).toBe(true);
  for (const { start, later } of shakes) if (later !== null) expect(later).toBeLessThan(start);
});

// A stomp holds the world 3 physics steps (a chain's later kills 4) and shakes the camera: at 2 steps and no shake, one
// reviewer measured a freeze and another saw none. The whole world holds: the other bugs, a popup still rising, every
// particle (the stomp's burst and the snow), the sky and the mist; with only the bodies held, the snow and the sparks
// moving on read as no freeze. The squished bug lies flat for 3 drawn frames once the world runs again, then vanishes:
// it just disappeared. With reduced motion there is neither freeze nor shake, and it lies flat for 3 frames. At an even
// 60 Hz clock a held step is a drawn frame without a physics step.
for (const reduced of [false, true])
  test(`a stomp ${reduced ? "with reduced motion neither holds the world nor shakes" : "holds the whole world 3 steps, flattens the bug and shakes the camera"}`, async ({
    page,
  }) => {
    if (reduced) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(clock, 60);
    await startLevel(page);
    const seen = (await page.evaluate(`new Promise((done) => {
      const l = (${level.toString()})(), p = l.player, cam = l.cameras.main;
      const [bug, other] = l.bugs.getChildren();
      p.moveTo(600, 380);
      (${placeBug.toString()})(bug, 600, 600);
      bug.setVelocityX(0);
      l.popup(900, 500, "+1", false, 0);
      const shakes = [];
      cam.on("camerashakestart", () => shakes.push(cam.shakeEffect.intensity.x));
      const emitters = l.children.list.filter((o) => o.type === "ParticleEmitter");
      const rising = l.children.list.find((o) => o.text === "+1");
      const world = () => [p.body.x, p.body.y, other.body.x, other.body.y, rising.y, l.layers[0].tilePositionX,
        ...l.fogs.map((f) => f.tilePositionX), ...emitters.flatMap((e) => e.alive.flatMap((q) => [q.x, q.y]))].join();
      const flat = () => l.children.list.some((o) => o.type === "Image" && o.visible && o.scaleY < 0.5 && o.frame.name === bug.frame.name);
      let [stepped, held, still, at, after] = [false, 0, true, undefined, -1];
      l.physics.world.on("worldstep", () => (stepped = true));
      l.events.on("postupdate", () => {
        if (after >= 0) {
          if (!flat()) return done({ held, still, shakes, kills: l.kills, bounced: p.body.velocity.y < 0, flat: after });
          after++;
        } else if (at !== undefined) {
          if (stepped) after = flat() ? 1 : 0;
          else {
            held++;
            still &&= world() === at && flat();
          }
        }
        if (l.kills && at === undefined) [at, after] = [world(), ${reduced} ? 1 : -1];
        stepped = false;
      });
    })`)) as {
      held: number;
      still: boolean;
      shakes: number[];
      kills: number;
      bounced: boolean;
      flat: number;
    };
    expect(seen).toEqual({
      held: reduced ? 0 : 3,
      still: true,
      shakes: reduced ? [] : [0.002],
      kills: 1,
      bounced: true,
      flat: 3,
    });
  });

// The squished bug flashes white the one frame it is squished, then lies screened pale blue (the snow's tint) until it
// vanishes: in its own dark colours it barely showed on the dark ground. Each drawn frame it shows, at an even 60 Hz.
test("a squished bug flashes white for one frame, then lies pale", async ({ page }) => {
  await page.addInitScript(clock, 60);
  await startLevel(page);
  const seen = await page.evaluate(`new Promise((done) => {
    const l = (${level.toString()})(), p = l.player;
    const [bug] = l.bugs.getChildren();
    p.moveTo(600, 380);
    (${placeBug.toString()})(bug, 600, 600);
    bug.setVelocityX(0);
    const seen = [];
    window.game.events.on("postrender", () => {
      const flat = l.corpses.find((c) => c.visible);
      if (flat) seen.push(flat.tintMode + ":" + flat.tint.toString(16));
      else if (seen.length) done(seen);
    });
  })`);
  // The frame it is squished in, the hit-stop's 3 and the 3 it lies flat after.
  expect(seen).toEqual(["1:ffffff", ...Array.from({ length: 6 }, () => "4:9fb8d0")]);
});

// A stomp's points show clear of the squished bug, all the frames it lies tinted: "+100" sat on it and hid its flash.
test("a stomp's points do not cover the squished bug", async ({ page }) => {
  await page.addInitScript(clock, 60);
  await startLevel(page);
  const seen = (await page.evaluate(`new Promise((done) => {
    const l = (${level.toString()})(), p = l.player;
    const [bug] = l.bugs.getChildren();
    p.moveTo(600, 540); // a short drop: from 380 he sank deep enough into the bug that the points cleared it
    (${placeBug.toString()})(bug, 600, 600);
    bug.setVelocityX(0);
    const seen = [];
    window.game.events.on("postrender", () => {
      const flat = l.corpses.find((c) => c.visible);
      const points = l.children.list.find((o) => o.type === "Text" && /^\\+\\d/.test(o.text));
      if (flat && points) {
        const [a, b] = [flat.getBounds(), points.getBounds()];
        seen.push(a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom);
      } else if (seen.length) done(seen);
    });
  })`)) as boolean[];
  expect(seen).toEqual(Array(7).fill(false));
});

// Landing on two bugs side by side squishes both, a chain of 2, and costs no life: the first stomp's bounce turned his
// fall upward in the same step, and the second bug then counted as a hit. Bodies 24 and 40 px apart, centre to centre,
// both under his feet.
for (const gap of [24, 40])
  test(`landing on two bugs ${gap} px apart squishes both`, async ({ page }) => {
    await startLevel(page);
    const seen = await page.evaluate(`new Promise((done) => {
      const l = (${level.toString()})(), p = l.player;
      l.invulnerableUntil = 0;
      const [a, b] = l.bugs.getChildren();
      p.moveTo(600, 380);
      for (const [bug, x] of [[a, 600 - ${gap} / 2], [b, 600 + ${gap} / 2]]) {
        (${placeBug.toString()})(bug, x, 600);
        bug.setVelocityX(0).setData("speed", 0);
      }
      l.physics.world.on("worldstep", () => {
        if (l.kills === 2 || l.lives < 3) done({ kills: l.kills, chain: l.longestChain, lives: l.lives });
      });
    })`);
    expect(seen).toEqual({ kills: 2, chain: 2, lives: 3 });
  });

// Both kills schedule a resume in one physics step. At 60 Hz the 58 ms timer holds three whole frames.
test("two hit-stops in one physics step resume after 58 ms (pin current behaviour pending a decision)", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(clock, 60);
  await startLevel(page);
  const seen = await page.evaluate(`new Promise((done) => {
    const l = (${level.toString()})(), p = l.player, world = l.physics.world;
    const [a, b] = l.bugs.getChildren();
    p.moveTo(600, 380);
    for (const [bug, x] of [[a, 588], [b, 612]]) {
      (${placeBug.toString()})(bug, x, 600);
      bug.setVelocityX(0).setData("speed", 0);
    }
    let step = 0, pauseFrame, resumeDelay, nextIsResume = false;
    const pauses = [];
    world.on("worldstep", () => step++);
    world.on("pause", () => {
      pauseFrame ??= window.game.loop.frame;
      pauses.push(step);
      nextIsResume = true;
    });
    const schedule = l.time.delayedCall.bind(l.time);
    l.time.delayedCall = (delay, callback, args, scope) => {
      if (!nextIsResume) return schedule(delay, callback, args, scope);
      nextIsResume = false;
      return schedule(delay, function (...values) {
        resumeDelay = Math.round(delay);
        return callback.apply(this, values);
      }, args, scope);
    };
    world.once("resume", () => done({
      pauses: pauses.length,
      sameStep: pauses[0] === pauses[1],
      kills: l.kills,
      resumeDelay,
      heldFrames: window.game.loop.frame - pauseFrame - 1,
    }));
  })`);
  expect(seen).toEqual({ pauses: 2, sameStep: true, kills: 2, resumeDelay: 58, heldFrames: 3 });
});

// Chain points rise above the wizard's head, each one a line above the last, never over his face, and over the
// night's light mask, which would turn their amber olive.
test("chain points show above the wizard, stacked", async ({ page }) => {
  await startLevel(page);
  await dashTwoBugs(page);
  const { popups, head, mask } = (await page.evaluate(`(() => {
    const l = (${level.toString()})();
    const popups = l.children.list.filter((o) => o.type === "Text" && /^\\+\\d/.test(o.text));
    return {
      popups: popups.map((o) => ({ top: o.getBounds().top, bottom: o.getBounds().bottom, depth: o.depth })),
      head: l.player.sprite.y - l.player.sprite.height,
      mask: l.mask.depth,
    };
  })()`)) as { popups: { top: number; bottom: number; depth: number }[]; head: number; mask: number };
  expect(popups).toHaveLength(2);
  for (const { depth } of popups) expect(depth).toBeGreaterThan(mask);
  for (const { bottom } of popups) expect(bottom).toBeLessThanOrEqual(head);
  expect(popups[1].bottom).toBeLessThanOrEqual(popups[0].top);
});

// The PRESS START board stays lit after Start, through the flight into the door.
test("the PRESS START board stays lit after Start", async ({ page }) => {
  await openTitle(page);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  const lit = await page.evaluate(() =>
    window.game.scene
      .getScene("title")
      .children.list.some((o) => (o as Phaser.GameObjects.Image).texture?.key === "press" && o.active),
  );
  expect(lit).toBe(true);
});

// The secret crystal's "+1" in the HUD carries the purple crystal icon, between the count and the hearts.
test("the HUD shows the secret crystal's icon by its +1", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})(), secret = l.children.list.find((o) => o.getData?.("secret"));
    l.invulnerableUntil = 1e12;
    l.player.moveTo(secret.x, secret.y + 20);
  })()`);
  await page.waitForFunction(`(${level.toString()})().secret`);
  // Atlas frames: props-1 is the secret crystal, props-2 and props-3 a full and an empty heart.
  const hud = (await page.evaluate(`(() => {
    const parts = (${level.toString()})().children.getByName("hud").list;
    const text = parts.find((o) => o.type === "Text");
    const icon = parts.find((o) => o.frame?.name === "props-1" && o.visible);
    const hearts = parts.filter((o) => ["props-2", "props-3"].includes(o.frame?.name));
    return {
      text: text.text,
      textRight: text.getBounds().right,
      icon: icon && { left: icon.getBounds().left, right: icon.getBounds().right },
      firstHeart: Math.min(...hearts.map((o) => o.getBounds().left)),
    };
  })()`)) as { text: string; textRight: number; icon?: { left: number; right: number }; firstHeart: number };
  expect(hud.text).toContain("+1");
  expect(hud.icon).toBeTruthy();
  expect(hud.icon!.left).toBeGreaterThanOrEqual(hud.textRight);
  expect(hud.icon!.right).toBeLessThanOrEqual(hud.firstHeart);
});

// The run's time starts with the wizard's first move: started in create(), it counted the time on the title,
// since the level's clock still reads 0 there, and showed 0:09 after 6 s on the title.
test("the timer starts at 0:00 however long the title showed", async ({ page }) => {
  await openTitle(page);
  await page.waitForTimeout(4000);
  await page.keyboard.press("Enter");
  await waitForLevel(page);
  const text = await page.evaluate(
    `(${level.toString()})().children.getByName("hud").getByName("timer").text`,
  );
  expect(text).toBe("0:00");
});

// The HUD shows the run's time, gold while the run still makes the gold time, grey after; the controls line
// names the goals the win panel scores, so they show before the first run ends.
test("the HUD shows the run's time and the controls line the goals", async ({ page }) => {
  await startLevel(page);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(100);
  await page.keyboard.up("ArrowRight");
  const timer = () =>
    page.evaluate(
      `(() => { const t = (${level.toString()})().children.getByName("hud").getByName("timer"); return [t.text, t.style.color]; })()`,
    ) as Promise<[string, string]>;
  await page.waitForTimeout(2000);
  const [early, gold] = await timer();
  expect(early).toMatch(/^0:0[2-9]$/);
  expect(gold).toBe("#fde68a");
  await page.evaluate(`(${level.toString()})().startedAt -= 40_000`);
  await page.waitForTimeout(100);
  const [late, grey] = await timer();
  expect(late).toMatch(/^0:4\d$/);
  expect(grey).toBe(colors.ampersand);
  const help = await page.evaluate(`(${level.toString()})().children.getByName("controls").text`);
  expect(help).toContain("UNDER 0:30 +500, RANK S AT 4600");
});

// The run's time waits for the first input, keyboard or touch: started when he could move, it showed 0:03 before
// the player pressed anything.
test("the timer waits for the first input", async ({ page }) => {
  await startLevel(page);
  const timer = `(${level.toString()})().children.getByName("hud").getByName("timer").text`;
  await page.waitForTimeout(2600);
  expect(await page.evaluate(timer)).toBe("0:00");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1600);
  expect(await page.evaluate(timer)).toMatch(/^0:0[12]$/);
  await page.keyboard.up("ArrowRight");
});

// A hidden tab stops the frames but not the clock the run's time read: back after 3 s hidden, the timer had jumped
// 3 s. The tab hides as a browser hides it: the visibility event, and no frames until it shows again.
test("the run's time skips the time the tab was hidden", async ({ page }) => {
  await startLevel(page);
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(`(${level.toString()})().startedAt < Infinity`);
  await page.keyboard.up("ArrowRight");
  const seconds = `(${level.toString()})().seconds()`;
  // 2 s run first: at 0 the time's floor of 0 would hide a shift that runs it backwards.
  await page.waitForTimeout(2000);
  const before = (await page.evaluate(seconds)) as number;
  const visibility = (hidden: boolean) => {
    Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
    if (hidden) window.game.loop.sleep();
    document.dispatchEvent(new Event("visibilitychange"));
    if (!hidden) window.game.loop.wake();
  };
  await page.evaluate(visibility, true);
  await page.waitForTimeout(3000);
  await page.evaluate(visibility, false);
  await page.waitForTimeout(200);
  // Neither the hidden 3 s, nor a shift that runs the time backwards: at most the 200 ms shown since.
  const after = (await page.evaluate(seconds)) as number;
  expect(after).toBeGreaterThanOrEqual(before);
  expect(after).toBeLessThanOrEqual(before + 1);
});

// A popup never starts under the canvas HUD: lifted above a wizard high in the view, points drew under it.
test("a popup starts below the HUD", async ({ page }) => {
  await startLevel(page);
  const seen = await page.evaluate(`(() => {
    const l = (${level.toString()})(), view = l.cameras.main.worldView;
    l.popup(l.player.sprite.x + 300, view.y + 4, "+999");
    const line = l.children.list.find((o) => o.text === "+999");
    return [line.y - line.displayHeight - view.y, l.hudBacking.y + l.hudBacking.height];
  })()`);
  const [top, hud] = seen as [number, number];
  expect(top).toBeGreaterThanOrEqual(hud);
});

// Turned sideways while points rise, they keep under the canvas HUD that turned on: placed upright, where the HUD is
// HTML above the canvas, they kept their rise and went under it. Every frame drawn until they are gone.
test("rising points stay under the HUD after turning sideways", async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 900 });
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})(), view = l.cameras.main.worldView;
    l.popup(l.player.sprite.x + 300, view.y + 40, "+100", true);
    const line = l.children.list.find((o) => o.text === "+100");
    window.under = Infinity;
    const look = () => {
      if (!line.active) return window.game.events.off("postrender", look);
      if (line.alpha > 0) window.under = Math.min(window.under, line.y - line.displayHeight - l.hudFloor);
    };
    window.game.events.on("postrender", look);
  })()`);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForFunction(`!(${level.toString()})().children.list.some((o) => o.text === "+100")`, null, {
    timeout: 5000,
  });
  expect(await page.evaluate("window.under")).toBeGreaterThanOrEqual(0);
});

// A popup keeps 8 px inside the view's left and right edges: "NAT 20!" by the view's left edge touched it.
test("a popup keeps inside the view's edges", async ({ page }) => {
  await startLevel(page);
  const seen = await page.evaluate(`(() => {
    const l = (${level.toString()})(), view = l.cameras.main.worldView;
    l.popup(view.x + 4, view.y + 300, "NAT 20!", false, 900);
    l.popup(view.right - 4, view.y + 300, "+100");
    const [a, b] = ["NAT 20!", "+100"].map((text) => l.children.list.find((o) => o.text === text).getBounds());
    return [a.left - view.x, view.right - b.right];
  })()`);
  const [left, right] = seen as [number, number];
  expect(left).toBeGreaterThanOrEqual(8);
  expect(right).toBeGreaterThanOrEqual(8);
});

// Points placed under the HUD stay under it as the view moves down: on the high route a stomp's "+100" was placed
// under the HUD with the view at the world's top, then he dropped off the route's end; the view followed him down and
// the points, fixed in the world, rose behind the HUD's backing, in 2 to 4 of 6 bot runs at 1920x1080. Every frame
// drawn until they are gone.
test("points stay clear of the HUD as the view moves down", async ({ page }) => {
  await page.addInitScript(clock, 60);
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})(), p = l.player;
    p.moveTo(152 * 48, 4 * 48);
  })()`);
  await page.waitForFunction(`(${level.toString()})().player.grounded`);
  await page.waitForTimeout(1500); // the view catches up with him
  await page.evaluate(`(() => {
    const l = (${level.toString()})(), p = l.player, view = l.cameras.main.worldView;
    ${bugsOff}
    l.popup(view.x + 200, view.y + 4, "+100", true);
    (${watchLines})();
    p.pad.right = true;
  })()`);
  await page.waitForFunction(`!(${level.toString()})().lines.length`, null, { timeout: 5000 });
  expect(await page.evaluate("window.lines")).toEqual({ texts: ["+100"], hud: 0, help: 0 });
});

// A stomp's points keep off the line on how to play while it shows: early in a run "+100" sat behind "ARROWS RUN,
// SPACE JUMPS, X DASHES" at the view's top. Placed at that line's height before the first input, every frame drawn.
test("a stomp's points keep off the controls line", async ({ page }) => {
  await page.addInitScript(clock, 60);
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})(), view = l.cameras.main.worldView, help = l.help.getBounds();
    (${watchLines})();
    l.popup(view.x + help.centerX, view.y + help.bottom - 4, "+100", true);
  })()`);
  await page.waitForFunction(`!(${level.toString()})().lines.length`, null, { timeout: 5000 });
  expect(await page.evaluate("window.lines")).toEqual({ texts: ["+100"], hud: 0, help: 0 });
});

// The controls line stays until the player first moves, however long that takes, then fades.
test("the controls line stays until the first input", async ({ page }) => {
  await startLevel(page);
  const help = `(() => { const t = (${level.toString()})().children.getByName("controls"); return [t.text, t.alpha]; })()`;
  await page.waitForTimeout(6000);
  const [text, alpha] = (await page.evaluate(help)) as [string, number];
  expect(text).toContain("X DASHES");
  expect(alpha).toBe(1);
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(`(${help})[1] === 0`);
  await page.keyboard.up("ArrowRight");
});

// The line on how to play never covers the wizard. On a phone held sideways "JUMP, THEN DASH BUTTON TO DASH" lay
// full-bright across his hat for about 2 s on the first high route, 108 to 128 frames a bot run, where a run reached
// the first gap's line up there. He lands there before passing the first gap and jumps along it, holding jump; every
// frame drawn for 3 s, on each landscape screen (touch below 1920, with the touch hints), the line, where it shows,
// stays off his frame, both read in view pixels.
for (const [width, height, touch] of [
  [844, 390, true],
  [1280, 720, true],
  [1920, 1080, false],
] as const)
  test(`the dash line never covers the wizard at ${width}x${height}`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: touch, isMobile: touch });
    await startLevel(page, touch);
    const seen = await page.evaluate(`new Promise((done) => {
      const l = (${level.toString()})(), p = l.player;
      ${bugsOff}
      p.moveTo(79 * 48, 4 * 48);
      l.physics.world.on("worldstep", () => {
        p.pad.right = true;
        p.pad.jump = !p.grounded || !p.pad.jump;
      });
      const seen = { shown: 0, covered: 0 };
      const over = (s, h) => s.x < h.right && h.x < s.right && s.y < h.bottom && h.y < s.bottom;
      const start = l.time.now;
      window.game.events.on("postrender", () => {
        const s = p.sprite.getBounds(), v = l.cameras.main.worldView;
        s.x -= v.x;
        s.y -= v.y;
        if (l.help.visible && l.help.alpha > 0 && l.help.text.startsWith("JUMP, THEN")) {
          seen.shown++;
          if (over(s, l.help.getBounds())) seen.covered++;
        }
        if (l.time.now - start > 3000) done(seen);
      });
    })`);
    console.log(`the dash line at ${width}x${height}: ${JSON.stringify(seen)}`);
    expect((seen as { shown: number }).shown).toBeGreaterThan(60);
    expect((seen as { covered: number }).covered).toBe(0);
    await page.close();
  });

// The dash is taught where it first pays: running up to the first gap shows how, once.
test("the first gap shows how to dash, once", async ({ page }) => {
  await startLevel(page);
  const help = `(() => { const t = (${level.toString()})().children.getByName("controls"); return [t.text, t.alpha]; })()`;
  // From the step before the gap (columns 15-22, map.txt row 12).
  const step = `(${level.toString()})().player.moveTo(16 * 48, 11 * 48)`;
  await page.evaluate(step);
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(`(${help})[0] === "JUMP, THEN X TO DASH"`);
  await page.keyboard.up("ArrowRight");
  await page.waitForFunction(`(${help})[1] === 0`);
  // Back on the step and up to the gap again: the line stays gone.
  await page.evaluate(step);
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(`(${level.toString()})().player.sprite.x > 20 * 48`);
  await page.keyboard.up("ArrowRight");
  expect(await page.evaluate(help)).toEqual(["JUMP, THEN X TO DASH", 0]);
});

// Level text is 1-bit like the title's: every pixel of its canvas fully on or off, no grey fringe.
test("level text has no antialiased pixels", async ({ page }) => {
  await startLevel(page);
  const soft = await page.evaluate(`(() => {
    const texts = (${level.toString()})().children.list.flatMap((o) => o.list ?? [o]).filter((o) => o.type === "Text");
    return texts.flatMap((t) => {
      const { data } = t.context.getImageData(0, 0, t.canvas.width, t.canvas.height);
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0 && data[i] < 255) n++;
      return n ? [t.text + ": " + n] : [];
    });
  })()`);
  expect(soft).toEqual([]);
});

// The stone shows no sky between its tiles: the middle tiles had a transparent right column (the fill a bottom row
// too), a line of sky at every join whatever the camera's scroll. Drawn alone on a magenta background, the start's
// ground (columns 2 to 20, from half into its top row down) shows none of it, at a whole and a fractional scroll.
test("the ground's tiles join without a gap", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    l.scene.pause();
    for (const o of l.children.list) if (o.texture?.key !== "tiles") o.setVisible(false);
    l.cameras.main.setBackgroundColor("#ff00ff");
  })()`);
  for (const x of [100, 100.25]) {
    const box = (await page.evaluate(`(() => {
      const c = (${level.toString()})().cameras.main;
      c.setScroll(${x}, Math.round(c.scrollY));
      c.preRender();
      const v = c.worldView;
      return [(2 * 48 - v.x) * 2, (13 * 48 + 24 - v.y) * 2, (21 * 48 - v.x) * 2, (16 * 48 - v.y) * 2].map(Math.round);
    })()`)) as number[];
    await page.waitForTimeout(100);
    await shoot(page);
    const sky = await page.evaluate(([x0, y0, x1, y1]) => {
      const { width, height, data } = window.shot;
      let n = 0;
      for (let y = y0; y < Math.min(y1, height); y++)
        for (let x = Math.max(x0, 0); x < Math.min(x1, width); x++) {
          const i = (y * width + x) * 4;
          if (data[i] > 150 && data[i + 2] > 150 && data[i + 1] < 90) n++;
        }
      return n;
    }, box);
    expect(sky, `scroll ${x}`).toBe(0);
  }
});

// The planks join as the stone does: the end planks' boards sat 4 art pixels lower than the middle ones', and a dark
// column at each tile's edge drew a line at every join. Read off the tiles texture: the board's top row (its snow's
// outline) is the same in the left end (frame 6, right of its post), the middle (7) and the right end (8, left of its
// post), and no column at a join is near black in more than 6 of the 15 rows from the snow to the board's bottom
// (rows 8 to 22: the board seams and shading, measured 3 to 5; the line was all 15).
test("the planks join level, without a dark line", async ({ page }) => {
  await startLevel(page);
  const { tops, dark } = (await page.evaluate(`(() => {
    const image = (${level.toString()})().textures.get("tiles").getSourceImage();
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = [image.width, image.height];
    const g = canvas.getContext("2d");
    g.drawImage(image, 0, 0);
    const px = (t, x, y) => g.getImageData(t * 48 + x, y, 1, 1).data;
    const top = (t, x) => { let y = 0; while (px(t, x, y)[3] === 0) y++; return y; };
    const median = (t, from, to) => {
      const ys = [];
      for (let x = from; x <= to; x++) ys.push(top(t, x));
      return ys.sort((a, b) => a - b)[ys.length >> 1];
    };
    const dark = [[6, 47], [7, 0], [7, 47], [8, 0]].map(([t, x]) => {
      let n = 0;
      for (let y = 8; y <= 22; y++) { const [r, gr, b] = px(t, x, y); if (r + gr + b < 120) n++; }
      return n;
    });
    return { tops: [median(6, 12, 40), median(7, 0, 47), median(8, 8, 36)], dark };
  })()`)) as { tops: number[]; dark: number[] };
  expect(new Set(tops).size, JSON.stringify(tops)).toBe(1);
  for (const n of dark) expect(n, JSON.stringify(dark)).toBeLessThanOrEqual(6);
});

// At 1280x720 the browser scaled the 1920 canvas smoothly and the HUD's digits read soft: where the canvas shows at
// least 960x540 CSS px it scales with hard edges (measured on the HUD's top-left 300x50 px: 412 mid-tone pixels
// before, 20 after); smaller, nearest sampling would drop art pixels, so there it stays smooth.
test("the canvas scales with hard edges where it shows at least 960x540", async ({ page }) => {
  const rendering = () =>
    page.evaluate(() => getComputedStyle(document.querySelector("canvas")!).imageRendering);
  await page.setViewportSize({ width: 1280, height: 720 });
  await startLevel(page);
  expect(await rendering()).toBe("pixelated");
  await page.setViewportSize({ width: 900, height: 500 });
  expect(await rendering()).toBe("auto");
});

// The stone fill has no joint running straight through all its courses: one at every tile's edge read as a grid.
// In the fill and under the snow top's cap, no column of art pixels is mortar (near black) from top to bottom.
test("the stone's joints are staggered", async ({ page }) => {
  await openTitle(page);
  const straight = await page.evaluate(() =>
    [
      [4, 0],
      [1, 16],
    ].flatMap(([frame, top]) => {
      const f = window.game.textures.getFrame("tiles", frame);
      const ctx = new OffscreenCanvas(48, 48).getContext("2d")!;
      ctx.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, 48, 48, 0, 0, 48, 48);
      const { data } = ctx.getImageData(0, 0, 48, 48);
      const mortar = (x: number, y: number) =>
        data[(y * 48 + x) * 4 + 3] > 0 &&
        data[(y * 48 + x) * 4] + data[(y * 48 + x) * 4 + 1] + data[(y * 48 + x) * 4 + 2] < 60;
      return [...Array(48).keys()]
        .filter((x) => [...Array(48 - top).keys()].every((k) => mortar(x, top + k)))
        .map((x) => `frame ${frame} column ${x}`);
    }),
  );
  expect(straight).toEqual([]);
});

// The camera and the layers draw on whole screen pixels: between them, the world and the layers blurred while it
// moved. Read every frame of a run along the start.
test("the camera and the layers stay on whole screen pixels", async ({ page }) => {
  await startAutopilot(page);
  const off = await page.evaluate(
    `new Promise((resolve) => {
      const l = (${level.toString()})(), c = l.cameras.main, off = [];
      let frames = 0;
      const look = () => {
        const values = [c.scrollX, c.scrollY, ...l.layers.flatMap((t) => [t.tilePositionX, t.y]), l.foreground.tilePositionX];
        for (const v of values) if (Math.abs(v * 2 - Math.round(v * 2)) > 1e-6) off.push(v);
        if (++frames < 120) return;
        window.game.events.off("postrender", look);
        resolve(off.length);
      };
      window.game.events.on("postrender", look);
    })`,
  );
  expect(off).toBe(0);
});

// Off the high route onto the last tree's strip (top 624), the camera looks down from the top of the jump: the landing
// showed as a sliver of snow at the view's bottom until he was nearly on it. 16 px of it show before his feet have
// fallen to y 300, 60 px below the route's top at 240, a sixth of the drop: with the HUD 4 px above his head, the
// view's bottom reaches 640 from feet at y 257. Two jumps, bugs off (whether the bot stomped the hopping bug up there
// decided the old run): a running jump off the second segment's end, and one from its middle (x 7336) over the pit,
// where the camera looked down only once he was over the strip and showed it with his feet at y 370, and a walk off
// the end without a jump.
for (const from of [0, 7336, -1])
  test(`dropping off the high route shows the landing early, ${from < 0 ? "walking off its end" : from ? `jumping at x ${from}` : "jumping off its end"}`, async ({
    page,
  }) => {
    await startLevel(page);
    const feet = await page.evaluate(`new Promise((done) => {
      const l = (${level.toString()})(), p = l.player;
      p.moveTo(7270, 200);
      ${bugsOff}
      let [jumped, seen, whole] = [false, undefined, undefined];
      l.physics.world.on("worldstep", () => {
        const b = p.body;
        p.pad.right = true;
        const edge = !l.physics.overlapRect(b.right, b.bottom + 2, 6, 4, false, true).length;
        if (!jumped && p.grounded && b.y < 300 && (${from} ? b.center.x >= ${from} : edge)) [jumped, p.pad.jump] = [true, ${from} >= 0];
      });
      window.game.events.on("postrender", () => {
        if (jumped && seen === undefined && l.cameras.main.worldView.bottom >= 624 + 16) seen = p.body.bottom;
        if (jumped && whole === undefined && l.cameras.main.worldView.bottom >= 624 + 48) whole = p.body.bottom;
        if (jumped && p.grounded && p.body.y > 300) done([seen, whole, p.body.bottom, l.lives]);
      });
    })`);
    console.log(`the landing shows with his feet at y ${JSON.stringify(feet)}`);
    const [seen, whole, landed, lives] = feet as [number, number, number, number];
    expect([landed, lives]).toEqual([624, 3]);
    expect(seen).toBeLessThan(300);
    // Looking down at four times the ease, the whole strip shows while his feet are still 172 px above it: at twice,
    // walking off, 47 of its 48 px showed there. The jumps start the look-down from higher, a step later.
    if (from < 0) expect(whole).toBeLessThan(624 - 172);
  });

// Across the high route's gap jumps the view moves at most 16.5 world px a frame vertically (the eased step's cap of 16
// plus half a px of rounding) and never drops and comes back: the look-down started at the take-off, moved the view
// 40 px down in one frame, and his rising head pulled it back up (x 4176 and 7151). Walking off the route's end, the
// look-down's first frame moved it 39.5 px. At an even 60 Hz clock, bugs off, from the jump or walk until 30 frames
// after he lands.
for (const [from, jump] of [
  [3980, true],
  [6990, true],
  [7300, false],
] as const)
  test(`the camera moves smoothly ${jump ? `on the high route's gap jump from x ${from}` : "walking off the high route"}`, async ({
    page,
  }) => {
    await page.addInitScript(clock, 60);
    await startLevel(page);
    const steps = (await page.evaluate(`new Promise((done) => {
      const l = (${level.toString()})(), p = l.player, cam = l.cameras.main;
      p.moveTo(${from}, 200);
      ${bugsOff}
      let [off, hold, landed, last] = [false, 0, 0, undefined];
      const steps = [];
      l.physics.world.on("worldstep", () => {
        const b = p.body;
        p.pad.right = true;
        const edge = !l.physics.overlapRect(b.right, b.bottom + 2, 6, 4, false, true).length;
        if (!off && p.grounded && edge) [off, p.pad.jump, hold] = [true, ${jump}, 18];
        else if (hold && !--hold) p.pad.jump = false;
      });
      window.game.events.on("postrender", () => {
        if (off && last !== undefined) steps.push(cam.scrollY - last);
        last = cam.scrollY;
        if (off && p.grounded && !p.pad.jump && ++landed > 30) done(steps);
      });
    })`)) as number[];
    expect(steps.length).toBeGreaterThan(40);
    expect(Math.max(...steps.map(Math.abs))).toBeLessThanOrEqual(16.5);
    const down = steps.findIndex((dy) => dy > 0);
    expect(steps.slice(down).filter((dy) => dy < 0)).toEqual([]);
  });

// Bouncing off the hopping bug's step (its right edge at x 2160, ground 48 px lower after it) or jumping off it, the
// camera never moves against his vertical direction by more than 3 world px in all: as he passed his apex the
// look-down aimed the view at his feet, above where he had stood, and it rose 37.5 px while he fell, then dropped 57.
// From the frame after the stomp's hold (its kick down is the stomp's) or the take-off to 30 frames after he lands, at
// an even 60 Hz clock, the other bugs off.
for (const stomp of [true, false])
  test(`the camera never swings against him ${stomp ? "bouncing off a bug" : "jumping"} down to lower ground`, async ({
    page,
  }) => {
    await page.addInitScript(clock, 60);
    await startLevel(page);
    await page.evaluate(`(() => {
      const l = (${level.toString()})();
      for (const bug of l.bugs.getChildren()) if (!bug.getData("hops") || bug.x > 2500) bug.disableBody(true, true);
      l.player.moveTo(2080, 420);
    })()`);
    await page.waitForTimeout(2000); // the camera comes over from the start
    const seen = (await page.evaluate(`new Promise((done) => {
      const l = (${level.toString()})(), p = l.player, cam = l.cameras.main;
      const hop = l.bugs.getChildren().find((bug) => bug.active);
      if (${stomp}) {
        p.moveTo(2130, 300);
        (${placeBug.toString()})(hop, 2130, 470);
        hop.setVelocityX(0).setData("speed", 0).setData("nextHop", l.time.now + 1e6);
      } else {
        hop.disableBody(true, true);
        p.moveTo(2100, 420);
      }
      let [started, landed, last, against] = [false, 0, cam.scrollY, 0];
      l.physics.world.on("worldstep", () => {
        p.pad.right = !${stomp} || l.kills > 0;
        p.pad.jump = !${stomp} && p.body.x < 2140;
      });
      window.game.events.on("postrender", () => {
        const [dy, vy] = [cam.scrollY - last, p.body.velocity.y];
        last = cam.scrollY;
        if (started && ((vy > 0 && dy < 0) || (vy < 0 && dy > 0))) against += Math.abs(dy);
        started ||= ${stomp} ? l.kills > 0 && !l.physics.world.isPaused : !p.grounded;
        if (started && p.grounded && ++landed > 30) done({ against, feet: p.body.bottom, kills: l.kills });
      });
    })`)) as { against: number; feet: number; kills: number };
    expect([seen.feet, seen.kills]).toEqual([624, stomp ? 1 : 0]);
    expect(seen.against).toBeLessThanOrEqual(3);
  });

// Running right, the view leads: he stands at 35 to 40 % of its width, so the ground ahead shows. Led by his facing
// alone, he stood at 56 % on average and at up to 80 %. Read every frame drawn while he runs from x 3350 to 3700 on the
// long ground after the crates (map.txt row 13, columns 60 to 77), after a run-up of 450 px, bugs off.
test("running right, the wizard stands at 35 to 40 % of the view", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    ${bugsOff}
    l.player.moveTo(2900, 600);
  })()`);
  await page.waitForTimeout(2500); // the camera comes over from the start
  await page.keyboard.down("ArrowRight");
  const at = (await page.evaluate(`new Promise((done) => {
    const l = (${level.toString()})(), p = l.player, at = [];
    window.game.events.on("postrender", () => {
      const v = l.cameras.main.worldView;
      if (p.sprite.x > 3350) at.push((p.sprite.x - v.x) / v.width);
      if (p.sprite.x > 3700) done(at);
    });
  })`)) as number[];
  await page.keyboard.up("ArrowRight");
  expect(at.length).toBeGreaterThan(30);
  expect(Math.min(...at)).toBeGreaterThanOrEqual(0.35);
  expect(Math.max(...at)).toBeLessThanOrEqual(0.4);
});

// The line on how to play fades out, moves to the other end of the view and fades in as he jumps toward it: it jumped
// from end to end in one frame. On the first high route, jumping all along it as in the dash line's test, at an even
// 60 Hz clock: every move happens while the line shows at alpha 0, after 4 frames fading out, and the line, where it
// shows, never covers him.
test("the line on how to play fades as it moves", async ({ page }) => {
  await page.addInitScript(clock, 60);
  await startLevel(page);
  const seen = (await page.evaluate(`new Promise((done) => {
    const l = (${level.toString()})(), p = l.player;
    ${bugsOff}
    p.moveTo(79 * 48, 4 * 48);
    l.physics.world.on("worldstep", () => {
      p.pad.right = true;
      p.pad.jump = !p.grounded || !p.pad.jump;
    });
    const over = (s, h) => s.x < h.right && h.x < s.right && s.y < h.bottom && h.y < s.bottom;
    const seen = { moves: [], covered: 0 };
    let [y, alphas] = [undefined, []];
    const start = l.time.now;
    window.game.events.on("postrender", () => {
      const s = p.sprite.getBounds(), v = l.cameras.main.worldView;
      s.x -= v.x;
      s.y -= v.y;
      if (l.help.alpha > 0 && over(s, l.help.getBounds())) seen.covered++;
      alphas = [...alphas.slice(-4), l.help.alpha];
      if (y !== undefined && l.help.y !== y) seen.moves.push(alphas);
      y = l.help.y;
      if (l.time.now - start > 3000) done(seen);
    });
  })`)) as { moves: number[][]; covered: number };
  expect(seen.moves.length).toBeGreaterThan(0);
  for (const fade of seen.moves) {
    expect(fade.at(-1)).toBe(0);
    expect(fade.slice(0, -1).every((a) => a > 0 && a < 1)).toBe(true);
  }
  expect(seen.covered).toBe(0);
});

// A hit holds the view until the respawn. The autopilot, hit by the hopping bug in its jump off the high route at
// x 7337, dropped back onto the route while the look-down its jump had started went on: the camera went 121 px down
// and back before the respawn. Here the hit comes 3 steps into that jump, the view's top read each drawn frame.
test("a hit in a jump off the high route holds the view until the respawn", async ({ page }) => {
  await startLevel(page);
  const tops = (await page.evaluate(`new Promise((done) => {
    const l = (${level.toString()})(), p = l.player;
    p.moveTo(7270, 200);
    ${bugsOff}
    let [air, hit] = [0, false];
    const tops = [];
    l.physics.world.on("worldstep", () => {
      p.pad.right = true;
      if (!air && p.grounded && p.body.center.x >= 7330) p.pad.jump = true;
      if (!p.grounded && ++air === 3) (hit = true) && l.hurt(false, -1);
    });
    window.game.events.on("postrender", () => {
      if (hit && !p.hit) done(tops);
      else if (hit) tops.push(l.cameras.main.scrollY);
    });
  })`)) as number[];
  expect(tops.length).toBeGreaterThan(20);
  expect(Math.max(...tops)).toBe(tops[0]);
});

// The HUD's text and icons share one pixel grid: each icon's corner on a whole art pixel as the text's, and no grey
// between a stroke and the backing (a text texture sampled linear and 8.16 px tall drew a grey line under each).
test("the HUD's text and icons sit on one grid, with no grey seam", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await startLevel(page);
  const corners = await page.evaluate(`(${level.toString()})().children.getByName("hud").list
    .filter((o) => o.type !== "Rectangle")
    .map((o) => [o.x - o.displayWidth * o.originX, o.y - o.displayHeight * o.originY, o.displayHeight])
    .flat()
    .filter((v) => v !== Math.round(v))`);
  expect(corners).toEqual([]);
  await page.evaluate(`(${level.toString()})().scene.pause()`);
  await page.waitForTimeout(100);
  await shoot(page);
  // The count's text, from its left edge to the hearts, on the backing: every pixel the backing or the text colour.
  const grey = await page.evaluate(() => {
    const { width, data } = window.shot;
    let n = 0;
    for (let y = 20; y < 100; y++)
      for (let x = 100; x < 300; x++) {
        const i = (y * width + x) * 4;
        const v = data[i] + data[i + 1] + data[i + 2];
        if (v > 120 && v < 600) n++;
      }
    return n;
  });
  expect(grey).toBe(0);
});
