import type Phaser from "phaser";
import { COLOR, REDUCED } from "../../design/tokens";

export function addPlaques(scene: Phaser.Scene) {
  plaque(scene, "level", ["LEVEL 2027"], { x: 239, y: 12, w: 52, h: 18 });
  const hint = plaque(scene, "press", ["PRESS", "START"], { x: 101, y: 25, w: 40, h: 20 });
  // Its blink swaps in the same letters unlit.
  if (!scene.textures.exists("press-dim")) paint(scene, "press-dim", ["PRESS", "START"], DIM);
  return hint;
}

export function blinkPlaque(scene: Phaser.Scene, hint: Phaser.GameObjects.Image) {
  // The blink switches the letters' light off and on, so they stay painted on the board.
  return REDUCED
    ? undefined
    : scene.time.addEvent({
        delay: 600,
        loop: true,
        callback: () => hint.setTexture(hint.texture.key === "press" ? "press-dim" : "press"),
      });
}

// The boards' lettering, like the plaques in the video: a 3x5 pixel font at 1x on the picture's own grid,
// amber letters with a highlight row and a dark drop shadow, centred in the board's inner panel.
const FONT: Record<string, string> = {
  A: ".#./#.#/###/#.#/#.#",
  E: "###/#../##./#../###",
  L: "#../#../#../#../###",
  P: "##./#.#/##./#../#..",
  R: "##./#.#/##./#.#/#.#",
  S: ".##/#../.#./..#/##.",
  T: "###/.#./.#./.#./.#.",
  V: "#.#/#.#/#.#/#.#/.#.",
  "0": ".#./#.#/#.#/#.#/.#.",
  "2": "##./..#/.#./#../###",
  "7": "###/..#/.#./.#./.#.",
};
const LIT = { top: COLOR.gold, fill: COLOR.amber, shadow: "#2a1608" };
const DIM = { top: "#b45309", fill: "#92400e", shadow: "#2a1608" };

function lineWidth(line: string) {
  return Array.from(line).reduce((w, ch, i) => w + (i ? 1 : 0) + (ch === " " ? 2 : 3), 0);
}

function paint(scene: Phaser.Scene, key: string, lines: string[], ink: typeof LIT) {
  const w = Math.max(...lines.map(lineWidth));
  const texture = scene.textures.createCanvas(key, w, lines.length * 7 - 1)!;
  const ctx = texture.getContext();
  for (const pass of ["shadow", "letters"]) {
    lines.forEach((line, row) => {
      let x = Math.floor((w - lineWidth(line)) / 2);
      for (const ch of line) {
        if (ch !== " ")
          FONT[ch].split("/").forEach((bits, y) =>
            Array.from(bits).forEach((bit, dx) => {
              if (bit !== "#") return;
              const shadow = pass === "shadow";
              ctx.fillStyle = shadow ? ink.shadow : y === 0 ? ink.top : ink.fill;
              ctx.fillRect(x + dx, row * 7 + y + (shadow ? 1 : 0), 1, 1);
            }),
          );
        x += (ch === " " ? 2 : 3) + 1;
      }
    });
  }
  texture.refresh();
}

function plaque(
  scene: Phaser.Scene,
  key: string,
  lines: string[],
  panel: { x: number; y: number; w: number; h: number },
) {
  if (!scene.textures.exists(key)) paint(scene, key, lines, LIT);
  const { width, height } = scene.textures.get(key).getSourceImage();
  return scene.add
    .image(panel.x + Math.floor((panel.w - width) / 2), panel.y + Math.floor((panel.h - height) / 2), key)
    .setOrigin(0);
}
