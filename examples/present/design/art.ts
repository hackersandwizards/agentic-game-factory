import Phaser from "phaser";
import { COLOR, HW } from "./tokens";
import { bakeBlood } from "./art/blood";
import { bakeFog, bakeGlow, bakeLight } from "./art/lighting";
import { neonSign } from "./art/neon";
import { bakeSprites } from "./art/sprites";

// The painted art is one atlas, built by studio/scripts/game-art.mjs from the generated sources in
// studio/game-art/ (frames named <sheet>-<n>; which frame is what: ATLAS below).
export const ATLAS = {
  wizard: {
    idle: "hero-0",
    blink: "hero-1",
    jump: "hero-2",
    fall: "hero-3",
    hit: "hero-4",
    run: ["hero-5", "hero-6", "hero-7", "hero-8", "hero-9", "hero-10"],
  },
  bug: ["bugs-0", "bugs-1"],
  fast: ["bugs-2", "bugs-3"],
  hop: ["bugs-4", "bugs-5"],
  crystal: "props-0",
  secret: "props-1",
  heart: "props-2",
  heartEmpty: "props-3",
  present: "props-4",
  cane: "props-5",
  d20: "props-6",
  sign: "props-7",
  ghost: "props-8",
  tree: "big-props-0",
  treeLit: "big-props-1",
  doorFrame: "big-props-2",
  doorPanel: "big-props-3",
  laptop: "big-props-4",
  laptopOn: "big-props-5",
  laptopGold: "big-props-6",
  crt: "big-props-7",
};

/** A soft round light, drawn additively: lamps, crystals, the staff tip. */
export function addGlow(scene: Phaser.Scene, x: number, y: number, tint: number, alpha = 1) {
  return scene.add.image(x, y, "glow").setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(alpha);
}

/** Draws every code sprite and a soft round glow into textures, once per game. */
export function bake(scene: Phaser.Scene) {
  bakeSprites(scene);
  if (!scene.textures.exists("neon-sign")) neonSign(scene);
  bakeLight(scene);
  bakeFog(scene);
  bakeRing(scene, "shockwave", 22, 2, null);
  bakeBlood(scene);
  bakeRing(scene, "pad", 49, 3, `${HW.teal}66`); // 66: 40 % alpha
  bakeGlow(scene);
}

// Pixel rings, set pixel by pixel: the stomp's shockwave (radius 22, 2 px thick) and the touch
// buttons (a see-through teal disc in a 3 px snow ring, the 1 px ring they had on the 320x180 layout).
function bakeRing(scene: Phaser.Scene, key: string, r: number, width: number, fill: string | null) {
  if (scene.textures.exists(key)) return;
  const size = 2 * r + 1;
  const texture = scene.textures.createCanvas(key, size, size)!;
  const ctx = texture.getContext();
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - r, y - r);
      if (d > r + 0.5) continue;
      ctx.fillStyle = d > r + 0.5 - width ? COLOR.snow : (fill ?? "transparent");
      ctx.fillRect(x, y, 1, 1);
    }
  texture.refresh();
}
