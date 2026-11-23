import Phaser from "phaser";
import { ATLAS, addGlow } from "../design/art";
import { COLOR, REDUCED, TEXT, TEXT_SCALE, TINT } from "../design/tokens";
import { TILE } from "../domain/terrain";

// Easter eggs: small nods to hacker, gamer, fantasy and cyberpunk folklore. Pure decoration, no physics.
// The d20 is a pickup (pickups.ts), the Konami code a part of the UI (ui/konami.ts).
const SIGN_INK = "#3a1c10";
export type EggKind = "terminal" | "ghost" | "sign" | "neon";

/**
 * Places one decoration standing on (x, bottom). `wizard` reads the wizard's sprite, made after the eggs, so the
 * terminal greets and the ghost peeks once as he comes close; `place` puts a line of text where it covers nothing, to
 * rise by up to `rise` as it fades (ui/popups.ts).
 */
export function addEgg(
  scene: Phaser.Scene,
  kind: EggKind,
  x: number,
  bottom: number,
  {
    wizard,
    place,
  }: {
    wizard: () => Phaser.GameObjects.Sprite;
    place: (line: Phaser.GameObjects.Text, rise: number) => void;
  },
) {
  const once = (reach: number, act: () => void) => {
    const timer = scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (Math.abs(wizard().x - x) > reach) return;
        timer.remove();
        act();
      },
    });
  };
  if (kind === "terminal") addTerminal(scene, x, bottom, once, place);
  if (kind === "ghost") {
    // Hides behind the tree one tile to the right, looks out once, then hides again.
    const ghost = scene.add
      .image(x + TILE, bottom - 18, "atlas", ATLAS.ghost)
      .setOrigin(0.5, 1)
      .setAlpha(0.85);
    once(240, () =>
      scene.tweens.add({ targets: ghost, x: x - 6, duration: 300, yoyo: true, hold: 900, ease: "Quad.out" }),
    );
  }
  if (kind === "sign") {
    // The board (26 px wide) is centred 25 px up from the post's foot; the number fits on it at 1x.
    scene.add.image(x, bottom, "atlas", ATLAS.sign).setOrigin(0.5, 1);
    scene.add.text(x, bottom - 25, "42", { ...TEXT, color: SIGN_INK }).setOrigin(0.5);
  }
  if (kind === "neon") {
    // A green neon sign on two posts standing on the ground three tiles down, flickering now and then. Its board's
    // centre sits 156 px above the posts' feet.
    const foot = bottom + 144;
    scene.add.image(x, foot, "neon-sign").setOrigin(0.5, 1);
    const glow = addGlow(scene, x, foot - 156, TINT.green, 0.35).setScale(3, 1);
    const text = scene.add
      .text(x, foot - 156, "SUDO MAGIC", { ...TEXT, color: COLOR.green })
      .setOrigin(0.5)
      .setScale(2);
    if (!REDUCED)
      scene.tweens.add({
        targets: [glow, text],
        alpha: 0.2,
        duration: 60,
        yoyo: true,
        repeat: -1,
        repeatDelay: 2600,
      });
  }
}

function addTerminal(
  scene: Phaser.Scene,
  x: number,
  bottom: number,
  once: (reach: number, act: () => void) => void,
  place: (line: Phaser.GameObjects.Text, rise: number) => void,
) {
  // The terminal's screen spans 32x26 pixels from (6, 6); the cursor blinks in its lower left.
  const crt = scene.add.image(x, bottom, "atlas", ATLAS.crt).setOrigin(0.5, 1);
  const cursor = scene.add.rectangle(crt.x - 12, crt.y - 24, 6, 4, TINT.green).setOrigin(0);
  if (!REDUCED)
    scene.tweens.add({
      targets: cursor,
      alpha: 0,
      duration: 1,
      hold: 400,
      repeatDelay: 400,
      yoyo: true,
      repeat: -1,
    });
  once(120, () => {
    const hello = scene.add
      // Above a wizard standing by it (his frame is 97 px tall) with a line of points between, so neither covers it.
      .text(x, bottom - 135, "hello, world", { ...TEXT, color: COLOR.green })
      .setOrigin(0.5, 1)
      .setScale(TEXT_SCALE)
      .setDepth(9);
    place(hello, 24);
    scene.tweens.add({
      targets: hello,
      alpha: 0,
      delay: 2000,
      duration: 800,
      onComplete: () => hello.destroy(),
    });
  });
}
