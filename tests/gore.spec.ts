import { expect, test } from "@playwright/test";
import type Phaser from "phaser";
import { keys, level, openTitle, startLevel } from "./game";

// The 18+ switch on the title: off on a new device, flipped by a tap on its chip or by G, never starting
// the game, and remembered across a reload.
test("the 18+ switch starts off and is remembered", async ({ page }) => {
  await openTitle(page);
  const chip = () =>
    page.evaluate(
      () =>
        (window.game.scene.getScene("title").children.getByName("gore") as Phaser.GameObjects.Image).texture
          .key,
    );
  expect(await chip()).toBe("chip-off");
  const canvas = (await page.locator("canvas").boundingBox())!;
  const scale = canvas.width / 320;
  await page.mouse.click(canvas.x + 291 * scale, canvas.y + 167 * scale);
  expect(await chip()).toBe("chip-on");
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.game.scene.isActive("title"))).toBe(true);
  await page.reload();
  await page.waitForFunction(() => window.game?.scene.isActive("title"));
  expect(await chip()).toBe("chip-on");
  await page.keyboard.press("g");
  expect(await chip()).toBe("chip-off");
  await page.reload();
  await page.waitForFunction(() => window.game?.scene.isActive("title"));
  expect(await chip()).toBe("chip-off");
});

// G and M pressed with another key, that key down and up in the same frame, flip their switch once: Phaser ran the
// frame's key events again on each new one, and the switch went on and straight back off (storage wrote "1", then
// "0" 1 ms later).
test("G and M pressed with another key in one frame flip once", async ({ page }) => {
  await openTitle(page);
  const writes = await page.evaluate(`new Promise((done) => {
    const writes = [], set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      writes.push(key + "=" + value);
      return set.call(this, key, value);
    };
    requestAnimationFrame(() => {
      (${keys.toString()})([["keydown", "KeyG", 71], ["keydown", "KeyM", 77], ["keydown", "KeyX", 88], ["keyup", "KeyX", 88],
        ["keyup", "KeyG", 71], ["keyup", "KeyM", 77]]);
      requestAnimationFrame(() => requestAnimationFrame(() => done(writes)));
    });
  })`);
  expect(writes).toEqual(["present-18plus=1", "present-muted=1"]);
  expect(
    await page.evaluate(
      () =>
        (window.game.scene.getScene("title").children.getByName("gore") as Phaser.GameObjects.Image).texture
          .key,
    ),
  ).toBe("chip-on");
});

// With 18+ on, a stomped bug leaves two or three separate splats on the ground, not a row of overlapping ones
// that reads as a red bar; they stay, and the HUD shows the mode.
test("a stomp in 18+ mode leaves separate splats on the ground", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("present-18plus", "1"));
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    window.bugsBefore = l.bugs.getChildren().length;
    const bug = l.bugs.getChildren()[0];
    l.player.moveTo(bug.x, bug.y - 90);
  })()`);
  await page.waitForFunction(`(${level.toString()})().bugs.getChildren().length < window.bugsBefore`);
  const splats: { x: number; width: number }[] = await page.evaluate(
    `(${level.toString()})().children.list.filter((o) => o.name === "blood" && o.visible).map((o) => ({ x: o.x, width: o.displayWidth })).sort((a, b) => a.x - b.x)`,
  );
  expect(splats.length).toBeGreaterThanOrEqual(2);
  expect(splats.length).toBeLessThanOrEqual(3);
  for (let i = 1; i < splats.length; i++)
    expect(splats[i].x - splats[i - 1].x).toBeGreaterThan(splats[i].width);
  await page.waitForTimeout(600);
  const blood = await page.evaluate(
    `(${level.toString()})().children.list.filter((o) => o.name === "blood" && o.visible && o.alpha > 0).length`,
  );
  expect(blood).toBeGreaterThan(0);
  const hud = await page.evaluate(
    `(${level.toString()})().children.getByName("hud").list.some((o) => o.texture?.key === "hud-chip")`,
  );
  expect(hud).toBe(true);
});

// Only fast and hopping bugs splash the screen: the kind was read after the bug was destroyed, which made every
// squished bug a big kill.
test("a plain bug's stomp in 18+ mode is not a big kill", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("present-18plus", "1"));
  await startLevel(page);
  await page.evaluate(`(() => {
    const l = (${level.toString()})();
    const squish = l.blood.squish.bind(l.blood);
    l.blood.squish = (x, y, big) => { window.big = big; squish(x, y, big); };
    const bug = l.bugs.getChildren().find((b) => b.getData("kind") === "bug");
    l.player.moveTo(bug.x, bug.y - 90);
  })()`);
  await page.waitForFunction(() => "big" in window);
  expect(await page.evaluate(() => (window as unknown as { big: boolean }).big)).toBe(false);
});
