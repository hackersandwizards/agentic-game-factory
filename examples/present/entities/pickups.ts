import type Phaser from "phaser";
import { ATLAS, addGlow } from "../design/art";
import { REDUCED, TINT } from "../design/tokens";
import type { NightLight } from "../systems/light";

/** What lies on the way: crystals (o), the secret crystal (*), a heart (v) and the d20 (d). */
export class Pickups {
  readonly crystals: Phaser.Physics.Arcade.StaticGroup;
  readonly hearts: Phaser.Physics.Arcade.StaticGroup;
  readonly dice: Phaser.Physics.Arcade.StaticGroup;
  private readonly scene: Phaser.Scene;
  private readonly light: NightLight;

  constructor(scene: Phaser.Scene, light: NightLight) {
    this.scene = scene;
    this.light = light;
    this.crystals = scene.physics.add.staticGroup();
    this.hearts = scene.physics.add.staticGroup();
    this.dice = scene.physics.add.staticGroup();
  }

  /** How many crystals the level holds, the secret one apart. */
  get total() {
    return this.crystals.getChildren().filter((c) => !c.getData("secret")).length;
  }

  addCrystal(x: number, px: number, py: number, secret: boolean) {
    const crystal = this.crystals.create(
      px,
      py,
      "atlas",
      secret ? ATLAS.secret : ATLAS.crystal,
    ) as Phaser.Physics.Arcade.Image;
    crystal.setData("secret", secret);
    // His box is his bottom 45 px, but his frame stands 97 tall: crystals at hat height vanished behind the hat
    // uncollected. The crystal's pickup reaches 40 px down by the hat and 6 px out to each side by its brim instead,
    // as a box that tall would reach up; nothing else touches crystals.
    (crystal.body as Phaser.Physics.Arcade.StaticBody)
      .setSize(crystal.width + 12, crystal.height + 40, false)
      .setOffset(-6, 0);
    crystal.setData("glow", addGlow(this.scene, px, py, secret ? TINT.secret : TINT.crystal, 0.6));
    this.light.add({ obj: crystal, r: 0.9, tint: secret ? TINT.secret : TINT.crystal, alpha: 0.8 });
    if (!REDUCED)
      this.scene.tweens.add({
        targets: crystal,
        y: py - 6,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
        delay: x * 60,
      });
  }

  addHeart(px: number, py: number) {
    const heart = this.hearts.create(px, py, "atlas", ATLAS.heart) as Phaser.Physics.Arcade.Image;
    heart.setData("glow", addGlow(this.scene, px, py, TINT.red, 0.4).setScale(0.6));
    this.light.add({ obj: heart, r: 0.7, tint: TINT.red, alpha: 0.6 });
    if (!REDUCED)
      this.scene.tweens.add({ targets: heart, scale: 1.2, duration: 400, yoyo: true, repeat: -1 });
  }

  /** The d20, a tabletop nod: it always rolls a natural 20. */
  addDie(px: number, py: number) {
    const die = this.dice.create(px, py, "atlas", ATLAS.d20) as Phaser.Physics.Arcade.Image;
    if (!REDUCED)
      this.scene.tweens.add({
        targets: die,
        y: py - 8,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });
  }

  /** A pickup he took goes, its glow with it. */
  take(pickup: Phaser.Physics.Arcade.Image) {
    (pickup.getData("glow") as Phaser.GameObjects.Image | undefined)?.destroy();
    pickup.destroy();
  }
}
