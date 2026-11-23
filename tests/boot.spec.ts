import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { shoot } from "./game";

// Every game page boots without console errors or warnings and draws more than one colour.
const games = readdirSync("examples").filter((name) => existsSync(`examples/${name}/index.html`));
for (const path of ["/starter/", ...games.map((name) => `/examples/${name}/`)]) {
  test(`${path} boots and renders`, async ({ page }) => {
    const errors: string[] = [];
    // GitHub's runner has no GPU: Chrome there logs four "GPU stall due to ReadPixels" driver warnings per page.
    const driver = /^\[\.WebGL-0x[\da-f]+\]GL Driver Message \(OpenGL, Performance, /;
    page.on("console", (msg) => {
      if (["error", "warning"].includes(msg.type()) && !driver.test(msg.text())) errors.push(msg.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(path);
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    await page.waitForTimeout(500);
    await page.waitForFunction(() => !!window.game);
    await shoot(page);
    const colours = await page.evaluate(() => {
      const pixels = window.shot.data;
      const seen = new Set<number>();
      for (let i = 0; i < pixels.length; i += 4)
        seen.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
      return seen.size;
    });
    expect(colours).toBeGreaterThan(1);
    expect(errors).toEqual([]);
  });
}

test("/ shows every game as a tile, with its cover where it has one, and links nothing else", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (["error", "warning"].includes(msg.type())) errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const links = page.locator("a");
  const hrefs = await links.evaluateAll((all) => all.map((a) => a.getAttribute("href")));
  expect(hrefs).toHaveLength(games.length);
  expect(new Set(hrefs)).toEqual(new Set(games.map((name) => `examples/${name}/`)));
  for (const text of await links.allInnerTexts()) expect(text.trim()).not.toBe("");
  for (const name of games) {
    const cover = page.locator(`a[href="examples/${name}/"] img`);
    if (existsSync(`examples/${name}/cover.webp`)) {
      await cover.scrollIntoViewIfNeeded();
      await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(640);
    } else await expect(cover).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
