import { expect, test } from "@playwright/test";
import { level, shoot, startLevel } from "./game";

// High on the last stretch the view looks down past the pits into the valley under the mountains: the lower quarter of
// the screen is painted, not one flat fill (which read as unfinished), and still darker than the ground he stands on,
// so a fall reads as a drop. Measured at 1920x1080: the valley shows 16 colours there, a luminance spread of 13 and a
// mean of 16 against the stone's 80; the flat night showed one colour.
test("high above a pit, the view's lower quarter shows the valley, darker than the ground", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await startLevel(page);
  // On the high route at columns 151-155 (map.txt row 5), over the pit at columns 140-157.
  await page.evaluate(
    `(() => { const l = (${level.toString()})(); l.invulnerableUntil = 1e12; l.player.moveTo(152 * 48, 200); })()`,
  );
  await page.waitForTimeout(2500);
  const view = (await page.evaluate(`(() => {
    const l = (${level.toString()})();
    l.children.list.forEach((o) => o.type === "ParticleEmitter" && o.setVisible(false));
    l.scene.pause();
    const { x, y } = l.cameras.main.worldView;
    return [x, y];
  })()`)) as number[];
  await page.waitForTimeout(100);
  await shoot(page);
  const { colours, spread, pit, ground } = await page.evaluate(([vx, vy]) => {
    const { width, height, data } = window.shot;
    const luma = (i: number) => 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
    // A box's distinct colours, luminance spread and mean. Screen px are 2 per world px at this size.
    const box = (x0: number, y0: number, x1: number, y1: number) => {
      const seen = new Set<number>();
      let [sum, sq, n] = [0, 0, 0];
      for (let y = Math.round(y0); y < y1; y++)
        for (let x = Math.round(x0); x < x1; x++) {
          const i = (y * width + x) * 4;
          seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
          const l = luma(i);
          [sum, sq, n] = [sum + l, sq + l * l, n + 1];
        }
      return { colours: seen.size, spread: Math.sqrt(sq / n - (sum / n) ** 2), mean: sum / n };
    };
    // The lower quarter left of the last tree's star (column 161), above the bottom's 20 art px of night.
    const low = box(0, height * 0.75, 1300, height - 40);
    // The stone of the platform he stands on, columns 151-155, row 5.
    const stone = box((151 * 48 - vx) * 2, (240 - vy) * 2, (156 * 48 - vx) * 2, (288 - vy) * 2);
    return { colours: low.colours, spread: low.spread, pit: low.mean, ground: stone.mean };
  }, view);
  expect(colours).toBeGreaterThan(8);
  expect(spread).toBeGreaterThan(3);
  expect(pit).toBeLessThan(ground / 2);
});
