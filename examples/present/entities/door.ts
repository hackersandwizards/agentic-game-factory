import type Phaser from "phaser";
import { ATLAS } from "../design/art";
import { sfx } from "../systems/sound";
import type { Wizard } from "./wizard";

// The door panel's bottom-left corner, from the frame's bottom centre: the frame's opening.
const DOOR = { x: 20, y: 2 };

/** The workshop's door (D), where the level starts. Returns its panel. */
export function addDoor(scene: Phaser.Scene, start: { x: number; y: number }) {
  // The door panel's hinge is its left edge, in the frame's opening.
  const frame = scene.add.image(start.x, start.y, "atlas", ATLAS.doorFrame).setOrigin(0.5, 1);
  return scene.add.image(frame.x - DOOR.x, start.y - DOOR.y, "atlas", ATLAS.doorPanel).setOrigin(0, 1);
}

export function openDoor(scene: Phaser.Scene, door: Phaser.GameObjects.Image, wizard: Wizard) {
  // Step out of the door from the workshop, then the door closes behind you.
  wizard.freeze();
  wizard.sprite.setAlpha(0);
  sfx.door();
  scene.tweens.chain({
    tweens: [
      { targets: door, scaleX: 0.15, duration: 350, ease: "Quad.out" },
      { targets: wizard.sprite, alpha: 1, duration: 150 },
      { targets: door, scaleX: 1, duration: 300, ease: "Quad.in", delay: 350 },
    ],
    onComplete: () => wizard.freeze(false),
  });
  scene.time.delayedCall(450, () => wizard.scriptWalk(1));
  scene.time.delayedCall(800, () => wizard.scriptWalk(0));
}
