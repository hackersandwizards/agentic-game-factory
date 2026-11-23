import type Phaser from "phaser";
import { TINT } from "../design/tokens";
import { ATLAS, addGlow } from "../design/art";
import { TILE } from "../domain/terrain";
import type { NightLight } from "../systems/light";

export type Tree = {
  x: number;
  lights: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  lit: boolean;
  shaken: number;
};

/** The Christmas trees: one lights up as he passes it and is the checkpoint from then on. */
export class Checkpoints {
  trees: Tree[] = [];
  private readonly scene: Phaser.Scene;
  private readonly light: NightLight;

  constructor(scene: Phaser.Scene, light: NightLight) {
    this.scene = scene;
    this.light = light;
  }

  add(px: number, bottom: number) {
    // The lit tree is the same painting with its lights on, faded in over the dark one.
    this.scene.add.image(px, bottom, "atlas", ATLAS.tree).setOrigin(0.5, 1);
    const lights = this.scene.add.image(px, bottom, "atlas", ATLAS.treeLit).setOrigin(0.5, 1).setAlpha(0);
    const glow = addGlow(this.scene, px, bottom - 60, TINT.amber, 0).setScale(2.5);
    addGlow(this.scene, px, bottom - 104, TINT.gold, 0.25).setScale(0.5); // the star's ring, always on
    this.trees.push({ x: px, lights, glow, lit: false, shaken: 0 });
    this.light.add({ obj: glow, r: 2.2, tint: TINT.amber, alpha: 0.9 });
  }

  /** Called every frame for each tree with where he is: `brush` where he shakes its snow off, every 2 s at most. */
  shake(tree: Tree, px: number, now: number, brush: (x: number, y: number) => void) {
    if (Math.abs(px - tree.x) < TILE / 2 && now > tree.shaken) {
      brush(tree.x, tree.lights.y - 70);
      tree.shaken = now + 2000;
    }
  }

  lightUp(tree: Tree) {
    tree.lit = true;
    this.scene.tweens.add({ targets: tree.lights, alpha: 1, duration: 300 });
    this.scene.tweens.add({ targets: tree.glow, alpha: 0.5, duration: 600 });
  }
}
