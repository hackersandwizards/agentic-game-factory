import { expect, test, type Page } from "@playwright/test";
import type Phaser from "phaser";
import {
  bugsOff,
  clock,
  keys,
  level,
  openTitle,
  placeBug,
  startLevel,
  waitForLevel,
  watchLines,
} from "./game";

// The Konami code on the title throws confetti (counted in the registry) and does not start the game. The
// confetti is as large on screen in the level (960 px grid, 2 screen px each) as on the title (320 px grid, 6 each).
const konamiCount = (page: Page) => page.evaluate((): unknown => window.game.registry.get("konami"));

test("the Konami code throws confetti, the same size on the title and in the level", async ({ page }) => {
  await openTitle(page);
  // Paced like a person: Phaser drops a key event whose code and timestamp match the previous one.
  const konami = async () => {
    for (const key of "ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight b a".split(
      " ",
    )) {
      await page.keyboard.press(key);
      await page.waitForTimeout(50);
    }
  };
  const size = (scene: string, perPixel: number) =>
    page
      .waitForFunction(
        ([scene, perPixel]) => {
          const emitter = window.game.scene
            .getScene(scene)
            .children.list.find(
              (o) =>
                o.type === "ParticleEmitter" &&
                (o as Phaser.GameObjects.Particles.ParticleEmitter).texture.key === "confetti",
            ) as Phaser.GameObjects.Particles.ParticleEmitter | undefined;
          let scale = 0;
          emitter?.forEachAlive((particle) => (scale = particle.scaleX), null);
          return scale && scale * perPixel;
        },
        [scene, perPixel] as const,
      )
      .then((handle) => handle.jsonValue());
  await konami();
  await expect.poll(() => konamiCount(page)).toBe(1);
  expect(await page.evaluate(() => window.game.scene.isActive("title"))).toBe(true);
  const title = await size("title", 6);
  await page.keyboard.press("Enter");
  await waitForLevel(page);
  await konami();
  expect(await size("level", 2)).toBe(title);
});

// Typed within one frame, the code still counts once: Phaser ran the frame's key events again on each new one, and the
// repeats broke the sequence.
test("the Konami code typed within one frame throws confetti once", async ({ page }) => {
  await openTitle(page);
  const codes = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, KeyB: 66, KeyA: 65 } as const;
  const events = "ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight KeyB KeyA"
    .split(" ")
    .flatMap((code) => ["keydown", "keyup"].map((type) => [type, code, codes[code as keyof typeof codes]]));
  await page.evaluate(`(${keys.toString()})(${JSON.stringify(events)})`);
  await expect.poll(() => konamiCount(page)).toBe(1);
});

// The terminal's "hello, world" shows above the wizard standing by it, with room for a line of points
// (30 px) between, so neither his head nor a stomp's points cover it.
test("the terminal greets above the wizard", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(`(${level.toString()})().player.moveTo(29 * 48, 11 * 48)`);
  await page.waitForFunction(`(${level.toString()})().player.grounded`);
  const { bottom, head } = (await page
    .waitForFunction(
      `(() => {
      const l = (${level.toString()})(), p = l.player.sprite;
      const hello = l.children.list.find((o) => o.text === "hello, world");
      return hello && { bottom: hello.getBounds().bottom, head: p.y - p.height };
    })()`,
    )
    .then((handle) => handle.jsonValue())) as { bottom: number; head: number };
  expect(bottom).toBeLessThanOrEqual(head - 30);
});

// No line of text appears over the wizard: the d20's "NAT 20!" showed on his face for half a second, and the
// terminal's "hello, world" across him mid-jump. Each text's bounds are read on the frame it first draws: onto the
// d20 (map.txt row 10, column 37), then in the air by the terminal (row 11, column 29), at the text's height.
test("no popup covers the wizard where it appears", async ({ page }) => {
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})(), fresh = [];
    window.popups = {};
    l.events.on("addedtoscene", (o) => o.type === "Text" && fresh.push(o));
    window.game.events.on("postrender", () => {
      const p = l.player.sprite.getBounds();
      for (const o of fresh.splice(0)) {
        const b = o.getBounds();
        window.popups[o.text] = b.x < p.right && p.x < b.right && b.y < p.bottom && p.y < b.bottom;
      }
    });
  })()`);
  for (const [text, x, y] of [
    ["NAT 20!", 37 * 48 + 24, 10 * 48 + 24],
    ["hello, world", 29 * 48 + 24, 400],
  ] as const) {
    await page.evaluate(`(${level.toString()})().player.moveTo(${x}, ${y})`);
    await page.waitForFunction(`window.popups[${JSON.stringify(text)}] !== undefined`);
    expect(await page.evaluate(`window.popups[${JSON.stringify(text)}]`), text).toBe(false);
  }
});

// A stomp next to the terminal: "+100" landed on "hello, world" and his hat clipped "world". Both were clamped to the
// same row under the HUD, with his head 4 px below it, and he bounced up through them. He drops onto a bug by the
// terminal holding jump, the highest bounce; every frame drawn for 3 s, no two shown texts overlap and none covers him.
test("a stomp by the terminal shows its points clear of the greeting and of the wizard", async ({ page }) => {
  await startLevel(page);
  const seen = await page.evaluate(`new Promise((done) => {
    const l = (${level.toString()})(), p = l.player, [bug] = l.bugs.getChildren();
    for (const other of l.bugs.getChildren().slice(1)) other.disableBody(true, true);
    p.moveTo(30 * 48, 9 * 48);
    p.pad.jump = true;
    (${placeBug.toString()})(bug, 30 * 48 + 24, 11 * 48 + 24);
    bug.setData("speed", 0);
    const seen = { texts: [], overlaps: 0, covers: 0, frames: 0 };
    const over = (a, b) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
    const start = l.time.now;
    window.game.events.on("postrender", () => {
      const shown = l.children.list.filter((o) => o.type === "Text" && o.visible && o.alpha > 0 && o.text && /^(\\+|hello)/.test(o.text));
      const hero = p.sprite.getBounds();
      const boxes = shown.map((o) => o.getBounds());
      for (const o of shown) if (!seen.texts.includes(o.text)) seen.texts.push(o.text);
      boxes.forEach((a, i) => {
        if (over(a, hero)) seen.covers++;
        for (const b of boxes.slice(i + 1)) if (over(a, b)) seen.overlaps++;
      });
      seen.frames++;
      if (l.time.now - start > 3000) done(seen);
    });
  })`);
  expect(seen).toMatchObject({
    texts: expect.arrayContaining(["+100", "hello, world"]),
    overlaps: 0,
    covers: 0,
  });
});

// The terminal's greeting keeps off the dash hint: "hello, world" showed on the line of "JUMP, THEN X TO DASH", between
// its words. The hint shows as he stands left of the terminal's reach; it is held in its lower slot, where it goes as
// he comes near its upper one, and he falls by the terminal from above the view. Every frame drawn until the greeting
// is gone.
test("the terminal's greeting keeps off the dash hint", async ({ page }) => {
  await page.addInitScript(clock, 60);
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    ${bugsOff}
    l.player.moveTo(26 * 48 + 24, 11 * 48);
  })()`);
  await page.waitForFunction(`(${level.toString()})().help.text.startsWith("JUMP")`);
  await page.waitForTimeout(1000); // the view catches up with him
  await page.evaluate(`(() => {
    const l = (${level.toString()})(), p = l.player;
    l.helpMoving = true; // the hint stays where it is set
    l.help.setY(540 - 72 - l.help.displayHeight);
    p.moveTo(26 * 48 + 24, -40);
    p.pad.right = true;
    (${watchLines})();
  })()`);
  await page.waitForFunction(`(${level.toString()})().lines.length`);
  await page.waitForFunction(`!(${level.toString()})().lines.length`, null, { timeout: 5000 });
  expect(await page.evaluate("window.lines")).toEqual({ texts: ["hello, world"], hud: 0, help: 0 });
});
