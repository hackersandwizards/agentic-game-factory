import Phaser from "phaser";
import { ATLAS, addGlow } from "../design/art";
import { GRID_SCALE, TINT } from "../design/tokens";
import type { NightLight } from "../systems/light";
import { sfx } from "../systems/sound";

type Carrier = { sprite: Phaser.GameObjects.Sprite; facing: number };
type Frames = { dark: string; lit: string; gold: string };

/** What stands at the level's end, and the present from the title that the wizard carries to it. */
export class Goal {
  /** The goal as it stands in the level: the camera leans toward it. */
  sight!: Phaser.GameObjects.Image;
  present!: Phaser.GameObjects.Image;
  private readonly scene: Phaser.Scene;
  private readonly light: NightLight;
  private readonly frames: Frames;

  /** `frames`: the goal's atlas frames, dark until the win, then lit, or gold with every crystal. */
  constructor(scene: Phaser.Scene, light: NightLight, frames: Frames) {
    this.scene = scene;
    this.light = light;
    this.frames = frames;
  }

  get x() {
    return this.sight.x;
  }

  add(px: number, bottom: number) {
    this.sight = this.scene.add.image(px, bottom, "atlas", this.frames.dark).setOrigin(0.5, 1);
  }

  addPresent(x: number, y: number) {
    this.present = this.scene.add
      .image(x, y, "atlas", ATLAS.present)
      .setOrigin(0.5, 1)
      .setDepth(11)
      .setAlpha(0);
  }

  /** Called every frame until the win: the present rides on his arm. */
  carry(carrier: Carrier) {
    const { sprite } = carrier;
    this.present.setPosition(sprite.x - carrier.facing * 32, sprite.y - 14).setAlpha(sprite.alpha);
    this.present.setAngle(sprite.angle);
  }

  /** The win beat: the present hops from the wizard's arm onto the goal, and the goal lights up, gold with `all`. */
  celebrate(all: boolean, landed: (x: number, y: number) => void) {
    const { sight, present } = this;
    present.setAngle(0).setAlpha(1);
    const from = { x: present.x, y: present.y };
    const to = { x: sight.x, y: sight.y - 48 };
    this.scene.tweens.addCounter({
      duration: 450,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        present.setPosition(
          Phaser.Math.Linear(from.x, to.x, t),
          Phaser.Math.Linear(from.y, to.y, t) - 72 * Math.sin(Math.PI * t),
        );
      },
      onComplete: () => {
        landed(to.x, to.y - 6);
        this.lightUp(all);
        sfx.win();
      },
    });
  }

  private lightUp(all: boolean) {
    const { sight } = this;
    sight.setFrame(all ? this.frames.gold : this.frames.lit);
    const tint = all ? TINT.gold : TINT.crystal;
    const screenGlow = addGlow(this.scene, sight.x, sight.y - 30, tint, 0).setScale(2);
    this.light.add({ obj: screenGlow, r: 2, tint, alpha: 1 });
    this.scene.tweens.add({ targets: screenGlow, alpha: 0.7, duration: 400 });
    const fountain = this.scene.add.particles(sight.x, sight.y - 66, "spark", {
      lifespan: 1200,
      speedY: { min: -120 * GRID_SCALE, max: -60 * GRID_SCALE },
      speedX: { min: -50 * GRID_SCALE, max: 50 * GRID_SCALE },
      gravityY: 120 * GRID_SCALE,
      frequency: all ? 30 : 60,
      blendMode: Phaser.BlendModes.ADD,
      tint: all ? [TINT.gold, TINT.amber] : [TINT.crystal, TINT.secret, TINT.amber, TINT.green],
    });
    this.scene.time.delayedCall(3000, () => fountain.stop());
  }
}
