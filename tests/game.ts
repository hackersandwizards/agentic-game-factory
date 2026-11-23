import type { Page } from "@playwright/test";
import type Phaser from "phaser";

// Shared by the tests: the game on window (set by each main.ts), booting the example, and a bot.
declare global {
  interface Window {
    game: Phaser.Game;
    shot: ImageData;
  }
}

/** What the autopilot reads of the level scene; the other tests reach the rest page side, untyped. */
export type Level = Phaser.Scene & {
  player: {
    body: Phaser.Physics.Arcade.Body;
    grounded: boolean;
    pad: Record<"left" | "right" | "jump" | "dash", boolean>;
    canDash: boolean;
    frozen: boolean;
  };
  bugs: Phaser.Physics.Arcade.Group;
};

/** The level scene, page side. Inside a string expression: `(${level})()`. */
export const level = () => window.game.scene.getScene("level") as Level;

export const bugsOff = `for (const bug of (${level.toString()})().bugs.getChildren()) bug.disableBody(true, true);`;

/**
 * Puts a bug at x, y between frames, page side: `(${placeBug})(bug, x, y)`. A bare body.reset keeps the bug's draw
 * offset between physics steps (entities/bugs.ts `walks`), which the next frame adds back, so the bug lands up to a step off.
 */
export const placeBug = (bug: Phaser.Physics.Arcade.Sprite, x: number, y: number) => {
  (bug.body as Phaser.Physics.Arcade.Body).reset(x, y);
  const { walks } = window.game.scene.getScene("level") as unknown as { walks: Record<string, unknown>[] };
  Object.assign(
    walks.find((walk) => walk.bug === bug)!,
    { dx: 0, dy: 0, ox: 0, oy: 0 },
  );
};

/**
 * Even animation-frame timestamps at `hz`: each native frame advances the clock by one period. Date.now reads the same
 * clock: Phaser's tweens time themselves with it, not with the frame's timestamp, so under load a 75 ms fade ended in
 * 2 drawn frames instead of 4 and failed "the line on how to play fades as it moves".
 */
export const clock = (hz: number) => {
  const raf = window.requestAnimationFrame.bind(window);
  let [time, last] = [0, -1];
  Date.now = () => time;
  window.requestAnimationFrame = (callback) =>
    raf((now) => {
      if (now !== last) [time, last] = [last < 0 ? now : time + 1000 / hz, now];
      callback(time);
    });
};

/**
 * Presses keys within one frame, page side: each `[type, code, keyCode]` a key event on the window, all in one task, so
 * no frame runs between them. Phaser reads the legacy keyCode, which a KeyboardEvent built in a page cannot take.
 */
export const keys = (events: [string, string, number][]) => {
  for (const [type, code, keyCode] of events) {
    const event = new KeyboardEvent(type, { code, bubbles: true });
    Object.defineProperty(event, "keyCode", { value: keyCode });
    window.dispatchEvent(event);
  }
};

/** Opens the example and waits for its title. */
export async function openTitle(page: Page) {
  await page.goto("/examples/present/");
  await page.waitForFunction(() => window.game?.scene.isActive("title"));
}

/** Waits until the level runs and the wizard has stepped out of the door. */
export async function waitForLevel(page: Page) {
  await page.waitForFunction(
    `(${level.toString()})()?.scene.isActive() && !(${level.toString()})().player.frozen`,
  );
}

/** Opens the example, starts it with Enter (a tap on a touch page) and waits until the wizard can move. */
export async function startLevel(page: Page, touch = false) {
  await openTitle(page);
  if (touch) await (await tapper(page))(480, 270);
  else await page.keyboard.press("Enter");
  await waitForLevel(page);
}

/**
 * Runs the wizard into the win from 200 px before the laptop, as a run of 25 s: from the start, the win came within a
 * second and showed "TIME 0:00 NEW BEST". `setup` runs first, page side, with `l` the level.
 */
export async function startFinish(page: Page, setup = "") {
  await page.evaluate(
    `(() => { const l = (${level.toString()})(); l.startedAt = l.time.now - 25000; ${setup}; l.player.moveTo(l.laptop.x - 200, l.laptop.y - 60); })()`,
  );
  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(`(${level.toString()})().won`);
  await page.keyboard.up("ArrowRight");
}

/** As startFinish, then waits until the win panel has shown and counted up its last line. */
export async function finish(page: Page, setup = "") {
  await startFinish(page, setup);
  await page.waitForFunction(`(${level.toString()})().children.getByName("panel")?.getData("done")`);
}

/** Every text the level shows, panels included, runs of spaces as one. */
export const texts = (page: Page) =>
  page.evaluate(
    `(${level.toString()})().children.list.flatMap((o) => o.list ?? [o]).flatMap((o) => o.text?.replace(/ +/g, " ") ?? [])`,
  ) as Promise<string[]>;

/** Screenshots the canvas as it shows on screen and decodes it page side into `window.shot`, for the next evaluate. */
export async function shoot(page: Page) {
  const png = (await page.locator("canvas").screenshot()).toString("base64");
  await page.evaluate(async (data) => {
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const ctx = new OffscreenCanvas(image.width, image.height).getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    window.shot = ctx.getImageData(0, 0, image.width, image.height);
  }, png);
}

/** Taps at the level's screen coordinates (960x540, the HUD's and touch buttons' grid) on a touch page. */
export async function tapper(page: Page) {
  const canvas = (await page.locator("canvas").boundingBox())!;
  const scale = canvas.width / 960;
  return (x: number, y: number) => page.touchscreen.tap(canvas.x + x * scale, canvas.y + y * scale);
}

/**
 * Starts the example level and hands it to an autopilot: it holds right and jumps at pits, walls,
 * ledges above and bugs, pressing the same pad the touch buttons press. With `dash`, it also dashes
 * when it starts falling over a pit with no ground below it, the timing the last gap needs; without,
 * it is the naive bot that gap is built to stop. Its waits count physics steps: counted in drawn frames, it held jump
 * twice as long at 30 Hz and never finished. `delay` ms after the wizard can first move, it takes over, as a
 * player who starts a moment later: the bugs then stand elsewhere when it reaches them.
 */
export async function startAutopilot(page: Page, dash = true, delay = 0) {
  await openTitle(page);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.game.scene.isActive("level"));
  await page.evaluate(
    ([dash, delay]) => {
      const level = window.game.scene.getScene("level") as Level;
      let hold = 0;
      let stuck = 0;
      let lastX = 0;
      let start = Infinity;
      level.physics.world.on("worldstep", () => {
        // He steps out of the door first: the delay counts from when he can move.
        if (start === Infinity && !level.player.frozen) start = level.time.now + delay;
        if (level.time.now < start) return;
        const { body: b, grounded, pad } = level.player;
        const solid = (x: number, y: number, w: number, h: number) =>
          level.physics
            .overlapRect(x, y, w, h, false, true)
            .some((o) => (o.gameObject as Phaser.GameObjects.Image).texture.key === "tiles");
        const pitAhead = !solid(b.right + 6, b.bottom + 6, 24, 180);
        const wallAhead = solid(b.right + 4, b.bottom - 42, 36, 30);
        const ledgeAbove = solid(b.right, b.bottom - 120, 96, 66);
        const bugAhead = (level.bugs.getChildren() as Phaser.Physics.Arcade.Sprite[]).some(
          (bug) => bug.x > b.x - 12 && bug.x - b.right < 120 && Math.abs(bug.y - b.center.y) < 72,
        );
        // Falling with nothing to land on: dash for the far side (the pad press is read on its rising edge). It
        // looks down the whole level's height: from the high route, a shallower look sees no ground below
        // and dashes past the landing into the pit after it.
        pad.dash =
          dash && !grounded && level.player.canDash && b.velocity.y > 0 && !solid(b.x, b.bottom, 140, 800);
        stuck = Math.abs(b.x - lastX) < 1.5 ? stuck + 1 : 0;
        lastX = b.x;
        pad.right = true;
        if (hold > 0) hold--;
        else if (pad.jump) pad.jump = false;
        else if (grounded && (pitAhead || wallAhead || ledgeAbove || bugAhead || stuck > 20)) {
          pad.jump = true;
          hold = 18;
          stuck = 0;
        }
      });
    },
    [dash, delay] as const,
  );
}

/**
 * Page side, `(${watchLines})()`: from then on, every frame drawn, counts in `window.lines` the shown popups and
 * greetings (the level's live lines) whose bounds meet the canvas HUD's backing (`hud`) or the line on how to play
 * while it shows (`help`), and keeps the texts seen. Read in view pixels: the texts on the world camera less its
 * view, the backing and the line on the UI camera, which draws the 960x540 grid unscrolled.
 */
export const watchLines = `() => {
  const l = (${level.toString()})(), hud = l.children.getByName("hud");
  window.lines = { texts: [], hud: 0, help: 0 };
  const over = (s, h) => s.x < h.right && h.x < s.right && s.y < h.bottom && h.y < s.bottom;
  window.game.events.on("postrender", () => {
    const v = l.cameras.main.worldView;
    for (const o of l.lines) {
      if (!o.visible || !o.alpha) continue;
      const b = o.getBounds();
      const s = { x: b.x - v.x, y: b.y - v.y, right: b.right - v.x, bottom: b.bottom - v.y };
      if (!window.lines.texts.includes(o.text)) window.lines.texts.push(o.text);
      if (hud.active && hud.visible && over(s, l.hudBacking.getBounds())) window.lines.hud++;
      if (l.help.visible && l.help.alpha > 0 && over(s, l.help.getBounds())) window.lines.help++;
    }
  });
}`;
