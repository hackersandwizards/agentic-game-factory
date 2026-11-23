import { devices, expect, test, type Page } from "@playwright/test";
import type Phaser from "phaser";
import { bugsOff, finish, level, openTitle, startFinish, startLevel, tapper, waitForLevel } from "./game";

// On a phone: a tap starts the example, holding the on-screen > button runs, the ^ button jumps.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });

/** Whether the title has started: Start shows the night behind the door at once. */
const started = () =>
  (window.game.scene.getScene("title").children.getByName("night") as Phaser.GameObjects.Container).visible;

/** Waits for game frames, not time, before reading `started`: a long frame inside a wall-clock wait can hide a real start. */
async function afterFrames(page: Page) {
  const frame = await page.evaluate(() => window.game.loop.frame);
  await page.waitForFunction((frame) => window.game.loop.frame > frame + 5, frame);
}

/**
 * A thumb slid across the pad, through Chrome's touch events: from > onto < it runs left within a step, off the pad
 * it lets go, and a second thumb on ^ stays held while the first slides. It ran right until the thumb lifted.
 */
async function slide(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const at = async (name: string) => {
    const box = (await page.getByRole("button", { name }).boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  };
  const [right, left, jump] = [await at("right"), await at("left"), { ...(await at("jump")), id: 2 }];
  const send = (
    type: "touchStart" | "touchMove" | "touchEnd",
    touchPoints: { x: number; y: number; id: number }[],
  ) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  const pad = () => page.evaluate(`({ ...(${level.toString()})().player.pad })`);
  const step = async () => {
    const frame = await page.evaluate(() => window.game.loop.frame);
    await page.waitForFunction((frame) => window.game.loop.frame > frame, frame);
  };
  await send("touchStart", [right]);
  await step();
  expect(await pad()).toMatchObject({ right: true, left: false });
  await send("touchMove", [left]);
  await step();
  expect(await pad()).toMatchObject({ right: false, left: true });
  await expect.poll(() => page.evaluate(`(${level.toString()})().player.body.velocity.x`)).toBeLessThan(0);
  await send("touchMove", [{ ...left, y: left.y - 300 }]);
  await step();
  expect(await pad()).toMatchObject({ right: false, left: false });
  await send("touchEnd", []);

  await send("touchStart", [right]);
  await send("touchStart", [right, jump]);
  await send("touchMove", [left, jump]);
  await step();
  expect(await pad()).toMatchObject({ right: false, left: true, jump: true });
  await send("touchEnd", [jump]);
  await step();
  expect(await pad()).toMatchObject({ left: true, jump: false });
  await send("touchEnd", []);
  await step();
  expect(await pad()).toMatchObject({ left: false, right: false, jump: false });
}

/**
 * Records every AudioContext the page makes, as `window.contexts`, and the unlock listeners on window, those whose
 * handler resumes a context, as `window.unlocks`, before the game loads. Resuming works only inside the gestures
 * WebKit counts, touchend, click and keydown, as on an iPhone: Chrome also counted the touch's pointerdown.
 */
const recordAudio = () => {
  const Real = window.AudioContext;
  const contexts: AudioContext[] = [];
  const unlocks = new Set<string>();
  Object.assign(window, { contexts, unlocks });
  window.AudioContext = class extends Real {
    constructor(options?: AudioContextOptions) {
      super(options);
      contexts.push(this);
    }
    override resume() {
      return ["touchend", "click", "keydown"].includes(window.event?.type ?? "")
        ? super.resume()
        : Promise.resolve();
    }
  };
  const [add, remove] = [window.addEventListener, window.removeEventListener];
  const key = (type: string, listener: unknown) =>
    String(listener).includes(".resume()") ? `${type} ${String(listener)}` : "";
  window.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    ...rest: []
  ) {
    if (key(type, listener)) unlocks.add(key(type, listener));
    return add.call(this, type, listener, ...rest);
  };
  window.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    ...rest: []
  ) {
    unlocks.delete(key(type, listener));
    return remove.call(this, type, listener, ...rest);
  };
};
const audioState = (page: Page) =>
  page.evaluate(() => (window as unknown as { contexts: AudioContext[] }).contexts.map((c) => c.state));
const unlockListeners = (page: Page) =>
  page.evaluate(() => (window as unknown as { unlocks: Set<string> }).unlocks.size);

// iOS counts a touch's pointerdown as no gesture, and the context resumed only in the first one stayed silent: every
// kind of gesture resumes it until it runs, and the listeners go then. A suspended context (iOS on a call) takes them
// back, and a tap on a pad button resumes it.
test("the first tap on the canvas starts the sound, a pad tap after a suspend restarts it", async ({
  page,
}) => {
  await page.addInitScript(recordAudio);
  await openTitle(page);
  expect(await audioState(page)).toEqual(["suspended"]);
  await (
    await tapper(page)
  )(480, 270);
  await expect.poll(() => audioState(page)).toEqual(["running"]);
  await expect.poll(() => unlockListeners(page)).toBe(0);

  await waitForLevel(page);
  await page.evaluate(() => (window as unknown as { contexts: AudioContext[] }).contexts[0].suspend());
  await expect.poll(() => unlockListeners(page)).toBe(5);
  const cdp = await page.context().newCDPSession(page);
  const box = (await page.getByRole("button", { name: "jump" }).boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => audioState(page)).toEqual(["running"]);
  await expect.poll(() => unlockListeners(page)).toBe(0);
});

// Sideways on a phone the buttons stand in the lower corners as on a gamepad, 66 CSS px, 16 px from the screen's edges
// and 16 px apart: < and > side by side on the left, the dash and the jump on the right. Stacked in the bands beside
// the canvas, the thumb reached up for the upper one. None is drawn on the canvas as well.
for (const [width, height] of [
  [844, 390],
  [932, 430],
  [667, 375],
])
  test.describe(`sideways ${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test("a thumb sliding over the sideways pad follows it", async ({ page }) => {
      await startLevel(page, true);
      await slide(page);
    });

    test("touch controls sit in the lower corners, start, run and jump", async ({ page }) => {
      await startLevel(page, true);
      const boxes = [];
      for (const name of ["left", "right", "dash", "jump"])
        boxes.push((await page.getByRole("button", { name }).boundingBox())!);
      expect(boxes.map(({ x, y, width, height }) => ({ x, y, width, height }))).toEqual([
        { x: 16, y: height - 16 - 66, width: 66, height: 66 },
        { x: 16 + 66 + 16, y: height - 16 - 66, width: 66, height: 66 },
        { x: width - 16 - 66 - 16 - 66, y: height - 16 - 66, width: 66, height: 66 },
        { x: width - 16 - 66, y: height - 16 - 66, width: 66, height: 66 },
      ]);
      const drawn = `(${level.toString()})().children.list.filter((o) => o.name === "controls" && o.texture?.key === "pad" && o.visible).length`;
      expect(await page.evaluate(drawn)).toBe(0);
      // The dash button names itself: its sparkle alone did not say what it does.
      const label = () =>
        page.evaluate(
          () => getComputedStyle(document.querySelector('[aria-label="dash"]')!, "::after").content,
        );
      expect(await label()).toBe('"DASH"');

      // Hold > for a second through Chrome's touch events.
      const cdp = await page.context().newCDPSession(page);
      const touch = async (type: "touchStart" | "touchEnd", name = "") => {
        const box = name && (await page.getByRole("button", { name }).boundingBox())!;
        const touchPoints = box ? [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] : [];
        await cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
      };
      const bodyX = `(${level.toString()})().player.body.x`;
      const bodyY = `(${level.toString()})().player.body.y`;
      const x0 = (await page.evaluate(bodyX)) as number;
      await touch("touchStart", "right");
      await page.waitForTimeout(1000);
      await touch("touchEnd");
      expect((await page.evaluate(bodyX)) as number).toBeGreaterThan(x0 + 120);

      // Tap ^: the wizard leaves the ground.
      const y0 = (await page.evaluate(bodyY)) as number;
      await touch("touchStart", "jump");
      await page.waitForTimeout(150);
      expect((await page.evaluate(bodyY)) as number).toBeLessThan(y0 - 30);
      await touch("touchEnd");
    });

    // The view leads him, so after a dash by the tree before the pillars he runs into the gap after it (x 5664) clear of
    // the corner buttons: led by his facing alone the view lagged after the dash and DASH covered him falling, at up to
    // 72 % of the view (3 frames at 667x375). Each frame drawn until the fall hurts him, his frame and, while the gap's far
    // edge (x 5808, y 624) shows, that corner stay off every button, read in CSS px on the page. Bugs off.
    test("after a dash, a fall into the pit stays clear of the corner buttons", async ({ page }) => {
      await startLevel(page, true);
      await page.evaluate(`(() => {
        const l = (${level.toString()})();
        ${bugsOff}
        l.player.moveTo(5300, 540);
      })()`);
      await page.waitForTimeout(2500); // the camera comes over
      const seen = await page.evaluate(`new Promise((done) => {
        const l = (${level.toString()})(), p = l.player, pad = document.getElementById("pad");
        const buttons = [...pad.children].map((b) => b.getBoundingClientRect());
        const inside = (x, y) => buttons.some((b) => b.left < x && x < b.right && b.top < y && y < b.bottom);
        const over = (s) => buttons.some((b) => s.x < b.right && b.left < s.right && s.y < b.bottom && b.top < s.bottom);
        const seen = { frames: 0, hero: 0, edge: 0, dashed: false };
        l.physics.world.on("worldstep", () => {
          p.pad.right = true;
          p.pad.dash = !seen.dashed && p.sprite.x > 5450;
          if (p.pad.dash) seen.dashed = true;
        });
        window.game.events.on("postrender", () => {
          if (p.hit) return done(seen);
          const v = l.cameras.main.worldView, c = l.game.canvas.getBoundingClientRect(), k = c.width / 960;
          const css = (x, y) => [c.x + (x - v.x) * k, c.y + (y - v.y) * k];
          const s = p.sprite.getBounds();
          const [x, y] = css(s.x, s.y), [right, bottom] = css(s.right, s.bottom);
          seen.frames++;
          if (over({ x, y, right, bottom })) seen.hero++;
          if (v.contains(5808, 624) && inside(...css(5808, 624))) seen.edge++;
        });
      })`);
      expect(seen).toMatchObject({ hero: 0, edge: 0, dashed: true });
      expect((seen as { frames: number }).frames).toBeGreaterThan(30);
    });

    // The HUD's speaker is a 44 CSS px target or more around its icon of about 21x17 CSS px: a tap 22 px left, right,
    // below and above its centre (or 1 px under the canvas's top edge, where that is lower) each mutes or unmutes.
    test("the HUD speaker takes a tap 22 CSS px from its centre", async ({ page }) => {
      await startLevel(page, true);
      const speaker = `(${level.toString()})().children.getByName("hud").getByName("speaker")`;
      const muted = () => page.evaluate(`${speaker}.texture.key === "hud-speaker-off"`);
      const at = (await page.evaluate(`(() => {
        const s = ${speaker}, c = window.game.canvas.getBoundingClientRect(), k = c.width / 960;
        return [c.x + s.x * k, c.y + s.y * k, c.y];
      })()`)) as number[];
      const [x, y, top] = at;
      for (const [tx, ty] of [
        [x - 22, y],
        [x + 22, y],
        [x, y + 22],
        [x, Math.max(top + 1, y - 22)],
      ]) {
        const before = await muted();
        await page.touchscreen.tap(tx, ty);
        expect(await muted(), `a tap at ${tx}, ${ty}`).toBe(!before);
      }
    });
  });

test("the HUD speaker mutes on a tap and stays muted after a reload", async ({ page }) => {
  const speaker = () =>
    page.evaluate(() => {
      const hud = window.game.scene
        .getScene("level")
        .children.getByName("hud") as Phaser.GameObjects.Container;
      return (hud.list.at(-1) as Phaser.GameObjects.Image).texture.key;
    });
  await startLevel(page, true);
  expect(await speaker()).toBe("hud-speaker");
  const x = await page.evaluate(
    () =>
      (
        (
          window.game.scene.getScene("level").children.getByName("hud") as Phaser.GameObjects.Container
        ).list.at(-1) as Phaser.GameObjects.Image
      ).x,
  );
  await (
    await tapper(page)
  )(x, 32);
  expect(await speaker()).toBe("hud-speaker-off");
  expect(await page.evaluate(() => localStorage.getItem("present-muted"))).toBe("1");
  await startLevel(page, true);
  expect(await speaker()).toBe("hud-speaker-off");
});

// The mute is kept under the game's own key, as the site's origin is shared; one kept under the old
// shared key "muted" carries over.
test("a mute kept under the old shared key carries over to the game's own", async ({ page }) => {
  await page.addInitScript(() => localStorage.getItem("present-muted") ?? localStorage.setItem("muted", "1"));
  await openTitle(page);
  expect(await page.evaluate(() => localStorage.getItem("present-muted"))).toBe("1");
  const speaker = await page.evaluate(
    () =>
      (window.game.scene.getScene("title").children.getByName("speaker") as Phaser.GameObjects.Image).texture
        .key,
  );
  expect(speaker).toBe("speaker-off");
});

// The title shows the speaker too: a tap on it mutes and starts nothing.
test("the title speaker mutes on a tap and starts nothing", async ({ page }) => {
  await openTitle(page);
  await page.waitForTimeout(500);
  await (
    await tapper(page)
  )(306 * 3, 167 * 3);
  expect(await page.evaluate(() => localStorage.getItem("present-muted"))).toBe("1");
  await afterFrames(page);
  expect(await page.evaluate(started)).toBe(false);
});

// Upright, the buttons move into the empty band under the canvas, each at least 44 px across and 16 px or more apart:
// on a 320 px phone the four 66 px buttons stood 7 to 9 px apart, the dash all but touching the right arrow. The two
// thumbs' pairs stand twice as far apart as the buttons within one: at 60 px all four stood 16 px apart there and read
// as one row. The dash line at the first gap reads on one line there: "JUMP," stood alone above the rest.
for (const [width, height] of [
  [390, 844],
  [320, 568],
])
  test.describe(`upright ${width}x${height}`, () => {
    test.use({ viewport: { width, height } });

    test("the touch buttons sit under the canvas, spaced, and run the wizard", async ({ page }) => {
      await startLevel(page, true);
      const canvas = (await page.locator("canvas").boundingBox())!;
      const boxes = [];
      for (const name of ["left", "right", "dash", "jump"])
        boxes.push((await page.getByRole("button", { name }).boundingBox())!);
      // 66 px where four fit with 16 px within each pair and 32 px between them inside the 16 px gutters, else
      // (width - 96) / 4: 56 at 320. Within a pair a quarter of the room left, 16 to 24 px; between them the rest.
      const size = Math.min(66, Math.floor((width - 96) / 4));
      const gap = Math.min(24, Math.max(16, (width - 32 - 4 * size) / 4));
      for (const box of boxes) {
        expect([box.width, box.height]).toEqual([size, size]);
        expect(box.y).toBeCloseTo(canvas.y + canvas.height + 16, 0); // the canvas's height is rounded
      }
      expect(boxes.map((box) => box.x)).toEqual([
        16,
        16 + size + gap,
        width - 16 - 2 * size - gap,
        width - 16 - size,
      ]);
      expect(boxes[2].x - boxes[1].x - size).toBeGreaterThanOrEqual(2 * gap);

      const right = boxes[1];
      const bodyX = `(${level.toString()})().player.body.x`;
      const x0 = (await page.evaluate(bodyX)) as number;
      const cdp = await page.context().newCDPSession(page);
      const point = { x: right.x + right.width / 2, y: right.y + right.height / 2 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
      await page.waitForTimeout(1000);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      expect((await page.evaluate(bodyX)) as number).toBeGreaterThan(x0 + 120);
    });

    test("a thumb sliding over the pad follows it", async ({ page }) => {
      await startLevel(page, true);
      await slide(page);
    });

    // Upright, the end screens' lines stand in the bands around the canvas, "TAP TO TRY AGAIN" and "TAP TO PLAY AGAIN"
    // among them, and taps there did nothing. A tap anywhere on the page restarts, under the canvas's rules: a touch
    // held from before GAME OVER does not, and on the win nothing does for its first 1.2 s.
    test("on the end screens a tap anywhere on the page restarts", async ({ page }) => {
      const state = `(() => { const l = (${level.toString()})(); return { lives: l.lives, gameOver: l.gameOver, won: l.won }; })()`;
      await startLevel(page, true);
      const cdp = await page.context().newCDPSession(page);
      const prompt = async (text: string) => {
        const box = (await page.getByText(text).boundingBox())!;
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      };
      await page.evaluate(`(${level.toString()})().lives = 1`);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: width / 2, y: 8 }],
      });
      await page.evaluate(`(${level.toString()})().player.moveTo(24 * 48 + 24, 600)`);
      await expect.poll(() => page.evaluate(`${state}.gameOver`)).toBe(true);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(300);
      expect(await page.evaluate(state)).toMatchObject({ lives: 0, gameOver: true });
      const again = await prompt("TAP TO TRY AGAIN");
      expect(again.y).toBeLessThan((await page.locator("canvas").boundingBox())!.y);
      await page.touchscreen.tap(again.x, again.y);
      await expect.poll(() => page.evaluate(state)).toMatchObject({ lives: 3, gameOver: false });

      await waitForLevel(page);
      await startFinish(page);
      const play = await prompt("TAP TO PLAY AGAIN");
      await page.touchscreen.tap(play.x, play.y);
      await page.waitForTimeout(300);
      expect(await page.evaluate(`${state}.won`)).toBe(true);
      await page.waitForTimeout(1200);
      await page.touchscreen.tap(play.x, play.y);
      await expect.poll(() => page.evaluate(`${state}.won`)).toBe(false);

      await waitForLevel(page);
      await startFinish(page);
      await page.waitForTimeout(1500);
      await page.touchscreen.tap(width / 2, height - 4);
      await expect.poll(() => page.evaluate(`${state}.won`)).toBe(false);
    });

    // Upright, the title's switches are HTML under the canvas: a tap on one starts the sound and starts nothing.
    test("a tap on the title's HTML switch starts the sound", async ({ page }) => {
      await page.addInitScript(recordAudio);
      await openTitle(page);
      await page.waitForFunction(() => !document.getElementById("switches")!.hidden);
      expect(await audioState(page)).toEqual(["suspended"]);
      await page.getByRole("button", { name: "18+" }).tap();
      await expect.poll(() => audioState(page)).toEqual(["running"]);
      await expect.poll(() => unlockListeners(page)).toBe(0);
      expect(await page.evaluate(started)).toBe(false);
    });

    // Upright, the canvas is a strip of about 220 px across the middle, and "TAP TO START" ignored a tap in the
    // bands above and below it. A tap anywhere on the page starts, and the sound with it; a tap on a switch flips it
    // and starts nothing.
    test("on the title a tap anywhere on the page but the switches starts", async ({ page }) => {
      await page.addInitScript(recordAudio);
      for (const name of ["the top band", "the bottom band", "the prompt"] as const) {
        await openTitle(page);
        await page.waitForFunction(() => !document.getElementById("switches")!.hidden);
        const canvas = (await page.locator("canvas").boundingBox())!;
        const y = {
          "the top band": 8,
          "the bottom band": height - 4,
          "the prompt": canvas.y + (172 / 180) * canvas.height,
        }[name];
        expect(y < canvas.y || y > canvas.y + canvas.height, name).toBe(name !== "the prompt");
        expect(await audioState(page), name).toEqual(["suspended"]);
        await page.touchscreen.tap(width / 2, y);
        await expect.poll(() => page.evaluate(started), name).toBe(true);
        await expect.poll(() => audioState(page), name).toEqual(["running"]);
      }

      await openTitle(page);
      await page.waitForFunction(() => !document.getElementById("switches")!.hidden);
      for (const label of ["18+", "sound"]) {
        const button = page.getByRole("button", { name: label });
        const before = await button.getAttribute("aria-pressed");
        await button.tap();
        await afterFrames(page);
        await expect(button, label).toHaveAttribute("aria-pressed", String(before === "false"));
        expect(await page.evaluate(started), label).toBe(false);
      }
    });

    test("the dash line reads on one line", async ({ page }) => {
      await startLevel(page, true);
      await page.evaluate(
        `(() => { const p = (${level.toString()})().player; p.moveTo(16 * 48, 11 * 48); p.pad.right = true; })()`,
      );
      await page.waitForFunction(() => document.getElementById("below")!.innerText.includes("JUMP, THEN"));
      const band = await page.evaluate(() => {
        const below = document.getElementById("below")!;
        return {
          text: below.innerText,
          lines: below.getBoundingClientRect().height / parseFloat(getComputedStyle(below).lineHeight),
        };
      });
      expect(Math.round(band.lines), band.text).toBe(1);
    });
  });

// On a touch device the title asks only for a tap.
test("the title says TAP TO START on touch", async ({ page }) => {
  await openTitle(page);
  expect(await page.evaluate(() => window.game.textures.exists("strip-TAP TO START"))).toBe(true);
  expect(await page.evaluate(() => window.game.textures.exists("strip-ENTER OR TAP TO START"))).toBe(false);
});

// On small iPhones held upright, the rotate hint sits above the canvas and touches neither it nor a button,
// and each button stays 44 CSS px or more across, on the screen.
for (const name of ["iPhone SE", "iPhone 13"]) {
  test.describe(name, () => {
    // Its size, pixel ratio and touch; the browser stays Chrome.
    const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices[name];
    test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent });

    test("the rotate hint covers neither the canvas nor the touch buttons", async ({ page }) => {
      await startLevel(page, true);
      const boxes = await page.evaluate(() =>
        ["#rotate", "canvas", "#hud", "#pad button"].flatMap((selector) =>
          [...document.querySelectorAll(selector)].map((el) => {
            const { top, bottom, left, right } = el.getBoundingClientRect();
            return { top, bottom, left, right };
          }),
        ),
      );
      const [hint, ...others] = boxes;
      // Each button 66 px where four fit with their gaps, else (width - 96) / 4: 56 at 320.
      const size = Math.min(66, Math.floor((viewport.width - 96) / 4));
      const gap = Math.min(24, Math.max(16, (viewport.width - 32 - 4 * size) / 4));
      const pad = others.slice(2);
      for (const button of pad)
        expect([button.right - button.left, button.bottom - button.top]).toEqual([size, size]);
      expect(pad.map((button) => button.left)).toEqual([
        16,
        16 + size + gap,
        viewport.width - 16 - 2 * size - gap,
        viewport.width - 16 - size,
      ]);
      expect(others.length).toBe(6);
      expect(hint.bottom - hint.top).toBeGreaterThan(0);
      expect(hint.top).toBeGreaterThanOrEqual(0);
      for (const box of others) {
        const overlap =
          hint.left < box.right && box.left < hint.right && hint.top < box.bottom && box.top < hint.bottom;
        expect(overlap, JSON.stringify({ hint, box })).toBe(false);
      }
    });
  });
}

// Every switch is at least 44 CSS px square to tap, on the smallest phone too: the title's 18+ chip and
// speaker, apart, so a tap between them flips neither, and the level's HUD speaker. Neither title icon
// touches the title's text. Upright, the title's switches are HTML buttons under the canvas, off the picture.
for (const name of [
  "iPhone SE",
  "iPhone SE (3rd gen)",
  "iPhone 13",
  "iPhone SE landscape",
  "iPhone 13 landscape",
]) {
  test.describe(name, () => {
    const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices[name];
    test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent });
    const upright = viewport.height > viewport.width;

    test("the switches are 44 CSS px targets and a tap between them flips neither", async ({ page }) => {
      await openTitle(page);
      // Each target's tappable square in CSS px, cut to the canvas, from its hit area and its world transform
      // (container included); grid is the scene's width in pixels.
      const targets = (scene: string, names: string[], grid: number) =>
        page.evaluate(
          ([scene, names, grid]) => {
            const c = window.game.canvas.getBoundingClientRect();
            const k = c.width / grid;
            return names.map((name) => {
              const o = window.game.scene
                .getScene(scene)
                .children.getAll()
                .flatMap((child) => ("list" in child ? (child.list as Phaser.GameObjects.Image[]) : [child]))
                .find((child) => child.name === name) as Phaser.GameObjects.Image;
              const hit = o.input!.hitArea as Phaser.Geom.Rectangle;
              const m = o.getWorldTransformMatrix();
              const left = c.left + (m.tx + (hit.x - o.width / 2) * m.scaleX) * k;
              const top = c.top + (m.ty + (hit.y - o.height / 2) * m.scaleY) * k;
              const size = hit.width * m.scaleX * k;
              return {
                left: Math.max(left, c.left),
                right: Math.min(left + size, c.right),
                top: Math.max(top, c.top),
                bottom: Math.min(top + size, c.bottom),
                canvas: c.bottom,
              };
            });
          },
          [scene, names, grid] as const,
        );
      const buttons = () =>
        page.evaluate(() => {
          const canvas = document.querySelector("canvas")!.getBoundingClientRect().bottom;
          return ["18+", "sound"].map((label) => {
            const { left, right, top, bottom } = document
              .querySelector(`#switches [aria-label="${label}"]`)!
              .getBoundingClientRect();
            return { left, right, top, bottom, canvas };
          });
        });
      const touching = await page.evaluate(() => {
        const title = window.game.scene.getScene("title");
        const icons = ["gore", "speaker"]
          .map((name) => title.children.getByName(name) as Phaser.GameObjects.Image)
          .filter((icon) => icon.visible)
          .map((icon) => icon.getBounds());
        const text = title.children.list
          .filter((o) => (o as Phaser.GameObjects.Image).texture?.key.startsWith("strip-"))
          .map((o) => (o as Phaser.GameObjects.Image).getBounds());
        return icons.flatMap((icon) =>
          text
            .filter(
              (line) =>
                icon.x < line.right && line.x < icon.right && icon.y < line.bottom && line.y < icon.bottom,
            )
            .map(() => icon),
        );
      });
      expect(touching).toEqual([]);
      const [chip, speaker] = upright ? await buttons() : await targets("title", ["gore", "speaker"], 320);
      // Upright the HTML switches are 48 px; on the canvas a hit area is at least 44 CSS px, and less only where
      // the canvas's edge clips it, which it must not.
      for (const box of [chip, speaker]) {
        const sides = [box.right - box.left, box.bottom - box.top];
        if (upright) expect(sides, JSON.stringify(box)).toEqual([48, 48]);
        else for (const side of sides) expect(side, JSON.stringify(box)).toBeGreaterThanOrEqual(44);
        if (upright) expect(box.top, JSON.stringify(box)).toBeGreaterThanOrEqual(box.canvas);
      }
      expect(chip.right).toBeLessThan(speaker.left);
      await page.touchscreen.tap((chip.right + speaker.left) / 2, (speaker.top + speaker.bottom) / 2);
      expect(
        await page.evaluate(() => [
          localStorage.getItem("present-18plus"),
          localStorage.getItem("present-muted"),
        ]),
      ).toEqual([null, null]);
      // The tap between them landed on the page beside the canvas upright: it starts the game with a tap there.
      if (upright) await (await tapper(page))(480, 270);
      await waitForLevel(page);
      // Upright the HUD, its speaker included, is HTML above the canvas.
      const [hud] = upright
        ? [(await page.locator("#hud").getByRole("button", { name: "sound" }).boundingBox())!].map((b) => ({
            left: b.x,
            right: b.x + b.width,
            top: b.y,
            bottom: b.y + b.height,
          }))
        : await targets("level", ["speaker"], 960);
      // Upright the HUD's speaker is a 44 px HTML button; on the canvas its hit area is at least 44 CSS px.
      const sides = [hud.right - hud.left, hud.bottom - hud.top];
      if (upright) expect(sides, JSON.stringify(hud)).toEqual([44, 44]);
      else for (const side of sides) expect(side, JSON.stringify(hud)).toBeGreaterThanOrEqual(44);
    });

    if (upright)
      test("a tap on the title's HTML switches flips them and starts nothing", async ({ page }) => {
        await openTitle(page);
        const [chip, sound] = [
          page.getByRole("button", { name: "18+" }),
          page.getByRole("button", { name: "sound" }),
        ];
        await expect(chip).toHaveAttribute("aria-pressed", "false");
        await expect(sound).toHaveAttribute("aria-pressed", "true");
        await chip.tap();
        await sound.tap();
        await afterFrames(page);
        await expect(chip).toHaveAttribute("aria-pressed", "true");
        await expect(sound).toHaveAttribute("aria-pressed", "false");
        expect(
          await page.evaluate(() => [
            localStorage.getItem("present-18plus"),
            localStorage.getItem("present-muted"),
          ]),
        ).toEqual(["1", "1"]);
        expect(await page.evaluate(started)).toBe(false);
      });
  });
}

// A portrait desktop window shows the HTML switches too: a clicked one must not keep the keyboard focus, or
// the Enter that starts the game would flip it back as well.
test.describe("Desktop 800x1000", () => {
  test.use({ viewport: { width: 800, height: 1000 }, hasTouch: false, isMobile: false });

  test("Enter after clicking a switch starts the game and flips nothing", async ({ page }) => {
    await openTitle(page);
    await page.getByRole("button", { name: "18+" }).click();
    await page.getByRole("button", { name: "sound" }).click();
    await page.keyboard.press("Enter");
    await waitForLevel(page);
    expect(
      await page.evaluate(() => [
        localStorage.getItem("present-18plus"),
        localStorage.getItem("present-muted"),
      ]),
    ).toEqual(["1", "1"]);
  });

  // A switch reached with Tab takes Enter and Space itself: each flips its switch and starts nothing.
  test("Enter or Space on a focused switch flips it and starts nothing", async ({ page }) => {
    await openTitle(page);
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.ariaLabel)).toBe("18+");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "sound" }).focus();
    await page.keyboard.press("Space");
    await afterFrames(page);
    expect(
      await page.evaluate(() => [
        localStorage.getItem("present-18plus"),
        localStorage.getItem("present-muted"),
      ]),
    ).toEqual(["1", "1"]);
    expect(await page.evaluate(started)).toBe(false);
  });
});

// On any screen shape, upright, sideways or a desktop window that is not 16:9, the page fits the screen
// exactly: nothing scrolls.
for (const name of [
  "iPhone SE landscape",
  "iPhone X landscape",
  "iPhone SE",
  "iPhone 13",
  "Desktop 1280x900",
]) {
  test.describe(name, () => {
    const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices[name] ?? {
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      userAgent: undefined,
    };
    test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent });

    test("the page does not scroll", async ({ page }) => {
      await openTitle(page);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(viewport.height);
    });
  });
}

// Upright, the canvas draws text about 8 CSS px tall, so how to play and the end screen also read at 12 px
// in the empty bands: how to play under the touch buttons, the panel above the canvas, the invitation below.
// A touch screen as wide as the canvas: the buttons stand on the canvas.
test.describe("touch 1280x720", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  // One pixel set: the speaker, the 18+ chip and the touch buttons draw their art pixels as large as the crystal and
  // the hearts do. They drew 3 art pixels a pixel, the 320x180 layout's, beside the crystal's 1. An image's pixel is
  // the largest width every run of one colour in its texture is a multiple of, times the scale it is drawn at.
  test("the HUD icons and touch buttons share the crystal's pixel size", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("present-18plus", "1"));
    await startLevel(page, true);
    const sizes = (await page.evaluate(`(() => {
      const l = (${level.toString()})();
      const pixel = (o) => {
        const { source, cutX, cutY, cutWidth: w, cutHeight: h } = o.frame;
        const ctx = new OffscreenCanvas(w, h).getContext("2d");
        ctx.drawImage(source.image, cutX, cutY, w, h, 0, 0, w, h);
        const data = new Uint32Array(ctx.getImageData(0, 0, w, h).data.buffer);
        const gcd = (a, b) => (b ? gcd(b, a % b) : a);
        let unit = 0;
        for (let y = 0; y < h; y++)
          for (let x = 0, run = 1; x < w; x++, run++) {
            const c = data[y * w + x];
            if (c === data[y * w + x + 1] && x + 1 < w) continue;
            unit = gcd(unit, run);
            run = 0;
          }
        return [o.texture.key, unit * o.getWorldTransformMatrix().scaleX];
      };
      const hud = l.children.getByName("hud").list.filter((o) => o.type === "Image");
      const buttons = l.children.list.filter((o) => o.name === "controls" && o.type === "Image" && o.visible);
      return { hud: hud.map(pixel), buttons: buttons.map(pixel) };
    })()`)) as { hud: [string, number][]; buttons: [string, number][] };
    const crystal = sizes.hud[0][1];
    expect(sizes.hud.map(([key]) => key)).toEqual(expect.arrayContaining(["hud-speaker", "hud-chip"]));
    expect(sizes.hud).toHaveLength(7); // the crystal, the secret crystal, 3 hearts, the speaker, the chip
    expect(sizes.buttons).toHaveLength(8);
    for (const [key, size] of [...sizes.hud, ...sizes.buttons]) expect(size, key).toBe(crystal);
  });

  // The dash line at the first gap names the touch button as the controls line does: as "*" it matched nothing on
  // the button, which shows a sparkle.
  test("the first gap shows how to dash with the touch button", async ({ page }) => {
    await startLevel(page, true);
    expect(await page.evaluate(`(${level.toString()})().children.getByName("controls").text`)).toContain(
      "DASH BUTTON DASHES",
    );
    await page.evaluate(
      `(() => { const p = (${level.toString()})().player; p.moveTo(16 * 48, 11 * 48); p.pad.right = true; })()`,
    );
    await page.waitForFunction(
      `(${level.toString()})().children.getByName("controls").text === "JUMP, THEN TAP DASH"`,
    );
  });
});

test.describe("iPhone SE upright", () => {
  const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices["iPhone SE"];
  test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent });

  // The longest HUD, 18+ mode's chip and the secret's "+1" included, fits the 320 px screen on one line with a 16 px
  // gutter each side and the speaker still 44 px: it ran to x 332, the count wrapped and the speaker shrank to 33 px.
  test("the longest HUD fits the screen on one line", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("present-18plus", "1"));
    await startLevel(page, true);
    await page.evaluate(`(() => {
      const l = (${level.toString()})();
      Object.assign(l, { crystals: l.totalCrystals - 1, secret: true });
      l.updateHud();
    })()`);
    const hud = await page.evaluate(() => {
      const box = document.getElementById("hud")!.getBoundingClientRect();
      const parts = [...document.getElementById("hud")!.children].map((part) => part.getBoundingClientRect());
      const button = document.querySelector("#hud button")!.getBoundingClientRect();
      return {
        text: document.getElementById("hud")!.innerText,
        left: box.left,
        right: Math.max(box.right, ...parts.map((part) => part.right)),
        rows: new Set(parts.map((part) => Math.round(part.top + part.height / 2))).size,
        tallest: Math.max(...parts.filter((part) => part.width).map((part) => part.height)),
        button: [button.width, button.height],
      };
    });
    expect(hud.text).toContain("+1");
    expect(hud.left).toBeGreaterThanOrEqual(16);
    expect(hud.right).toBeLessThanOrEqual(viewport.width - 16);
    expect(hud.rows, JSON.stringify(hud)).toBe(1);
    expect(hud.tallest, JSON.stringify(hud)).toBeLessThanOrEqual(44);
    expect(hud.button).toEqual([44, 44]);
    // The speaker says whether sound is on to a screen reader too.
    const sound = page.locator("#hud").getByRole("button", { name: "sound" });
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await sound.tap();
    await expect(sound).toHaveAttribute("aria-pressed", "false");
  });

  test("the controls line and the end screen read at 12 px in the bands", async ({ page }) => {
    const band = (id: string) =>
      page.evaluate((id) => {
        const element = document.getElementById(id)!;
        const box = element.getBoundingClientRect();
        const canvas = document.querySelector("canvas")!.getBoundingClientRect();
        return {
          text: element.hidden ? "" : element.innerText,
          size: parseFloat(getComputedStyle(element).fontSize),
          top: box.top,
          bottom: box.bottom,
          canvasTop: canvas.top,
          canvasBottom: canvas.bottom,
          pad: document.getElementById("pad")!.getBoundingClientRect().bottom,
        };
      }, id);
    await startLevel(page, true);
    // The HUD is HTML above the canvas, its count at 12 CSS px too, and the canvas draws none.
    const hud = await band("hud");
    expect(hud.text).toContain("0/");
    expect(hud.size).toBeGreaterThanOrEqual(12);
    expect(hud.bottom).toBeLessThanOrEqual(hud.canvasTop);
    expect(await page.evaluate(`(${level.toString()})().children.getByName("hud").visible`)).toBe(false);
    const help = await band("below");
    expect(help.text).toContain("DASHES");
    expect(help.size).toBeGreaterThanOrEqual(12);
    expect(help.top).toBeGreaterThanOrEqual(help.pad);
    expect(help.bottom).toBeLessThanOrEqual(viewport.height);
    // A line of how to play wraps only after a comma: "4600" once stood on a line of its own. The characters before
    // each wrap in a band, read off where each character is drawn.
    const wraps = (band: string) =>
      page.evaluate((band) => {
        const range = document.createRange();
        return [...document.querySelectorAll(`#${band} span`)].flatMap((span) => {
          const chars: [string, number][] = [];
          for (const node of span.childNodes)
            for (let i = 0; i < node.textContent!.length; i++) {
              range.setStart(node, i);
              range.setEnd(node, i + 1);
              chars.push([node.textContent![i], range.getBoundingClientRect().top]);
            }
          return chars.flatMap(([, top], i) => (i > 1 && top > chars[i - 1][1] ? [chars[i - 2][0]] : []));
        });
      }, band);
    const starts = await wraps("below");
    expect(starts.length).toBeGreaterThan(0);
    for (const char of starts) expect(char).toBe(",");

    await finish(page);
    const [panel, footer] = [await band("above"), await band("below")];
    expect(panel.text).toContain("SCORE");
    // The hint to the next rank in the canvas panel's words, wrapped only after a comma.
    expect(panel.text.replace(/\s+/g, " ")).toMatch(/RANK [A-Z] AT \d+: [A-Z ]+, [A-Z ]+/);
    for (const char of await wraps("above")) expect(char).toBe(",");
    expect(panel.top).toBeGreaterThanOrEqual(0);
    expect(panel.bottom).toBeLessThanOrEqual(panel.canvasTop);
    expect(footer.text).toContain("YOUR TURN");
    expect(footer.top).toBeGreaterThanOrEqual(footer.canvasBottom);
    expect(footer.bottom).toBeLessThanOrEqual(viewport.height);
    for (const { size } of [panel, footer]) expect(size).toBeGreaterThanOrEqual(12);
    // The repo URL wraps only after a "/" or a "-": the character before every line start is one of them.
    const breaks = await page.evaluate(() => {
      const text = [...document.querySelectorAll("#below span")].find((span) =>
        span.textContent!.startsWith("github.com"),
      )!;
      const url = text.textContent!;
      const range = document.createRange();
      const tops: number[] = [];
      let at = 0;
      for (const node of text.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        for (let i = 0; i < node.textContent!.length; i++, at++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          tops[at] = range.getBoundingClientRect().top;
        }
      }
      return tops.flatMap((top, i) => (i && top > tops[i - 1] ? [url[i - 1]] : []));
    });
    expect(breaks.length).toBeGreaterThan(0);
    for (const char of breaks) expect("/-").toContain(char);
  });
});
