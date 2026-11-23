import Phaser from "phaser";
import { HEIGHT, REDUCED, TINT, WIDTH } from "../design/tokens";

// 18+ mode: a squished bug bursts into red blood. Off by default and remembered on this device only;
// storage can be blocked (private mode, sandboxed iframe), so it starts off then.
const KEY = "present-18plus";
export let gore = (() => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();

/** The title's 18+ chip or G switches the mode. */
export function toggleGore() {
  gore = !gore;
  try {
    localStorage.setItem(KEY, gore ? "1" : "0");
  } catch {
    // storage blocked: the mode lasts until the page reloads
  }
  return gore;
}

const NEON_YELLOW = 0xfff27a;
const FLARE_RED = 0xff1a2e;
const DECALS = 48; // splats on the ground, the oldest reused first

/**
 * The level's blood, made once per run and only in 18+ mode: a pooled spray with neon sparks, splats
 * that stay where they land, and on bigger kills a short splash on the screen's edges with drips.
 */
export class Blood {
  private spray: Phaser.GameObjects.Particles.ParticleEmitter;
  private neon: Phaser.GameObjects.Particles.ParticleEmitter;
  private decals: Phaser.GameObjects.Image[];
  private next = 0;
  private splashes: Phaser.GameObjects.Image[][] = [];
  private flash: Phaser.GameObjects.Image;
  private scene: Phaser.Scene;
  // surface(x, y): the y of the first ground top below y in column x, or -1 over a pit.
  private surface: (x: number, y: number) => number;

  /** ui(obj) puts an object on the screen-fixed camera. */
  constructor(
    scene: Phaser.Scene,
    surface: (x: number, y: number) => number,
    ui: (obj: Phaser.GameObjects.Image) => void,
  ) {
    this.scene = scene;
    this.surface = surface;
    this.spray = scene.add
      .particles(0, 0, "drop", {
        frame: [0, 1, 1, 2, 2, 3, 4],
        frequency: -1,
        lifespan: { min: 400, max: 900 },
        speed: { min: 60, max: 300 },
        angle: { min: 195, max: 345 },
        gravityY: 700,
        maxAliveParticles: 260,
      })
      .setDepth(12);
    this.neon = scene.add
      .particles(0, 0, "spark", {
        frequency: -1,
        lifespan: 300,
        speed: { min: 120, max: 340 },
        scale: { start: 0.9, end: 0 },
        tint: [TINT.glitch, NEON_YELLOW],
        blendMode: Phaser.BlendModes.ADD,
        maxAliveParticles: 40,
      })
      .setDepth(13);
    // A red neon flare at the kill, additive like every light here.
    this.flash = scene.add
      .image(0, 0, "glow")
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(FLARE_RED)
      .setScale(1.2)
      .setDepth(13)
      .setVisible(false);
    this.decals = Array.from({ length: DECALS }, () =>
      scene.add
        .image(0, 0, "splat-0")
        .setOrigin(0.5, 14 / 30)
        .setDepth(2)
        .setVisible(false)
        .setName("blood"),
    );
    if (!REDUCED) this.addScreenSplashes(ui);
  }

  private addScreenSplashes(ui: (obj: Phaser.GameObjects.Image) => void) {
    const scene = this.scene;
    // Two splashes, one per side, each with a drip running from it and a cyan ghost a few pixels off, the
    // colour split of a glitching screen; on the 960x540 grid at 2x.
    for (const side of [0, 1]) {
      const ghost = scene.add.image(0, 0, "splatter").setScale(2).setTint(TINT.glitch);
      ghost.setBlendMode(Phaser.BlendModes.ADD);
      const blob = scene.add.image(0, 0, "splatter").setScale(2);
      const drip = scene.add.image(0, 0, "drip").setScale(2).setOrigin(0.5, 0);
      for (const part of [ghost, blob, drip]) {
        ui(
          part
            .setDepth(29)
            .setVisible(false)
            .setFlipX(side === 1),
        );
      }
      this.splashes.push([blob, drip, ghost]);
    }
  }

  /** A stomped bug bursts; big kills (fast and hopping bugs) also splash the screen. */
  squish(x: number, y: number, big: boolean) {
    this.spray.explode(big ? 110 : 70, x, y - 4);
    this.neon.explode(big ? 12 : 8, x, y - 4);
    this.flash
      .setPosition(x, y - 8)
      .setAlpha(0.7)
      .setVisible(true);
    this.scene.tweens.killTweensOf(this.flash);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: 0,
      duration: 260,
      onComplete: () => this.flash.setVisible(false),
    });
    // Two or three separate splats, 64 px apart, so they never run together into one bar.
    for (const step of Phaser.Utils.Array.Shuffle([-1, 0, 1]).slice(big ? 0 : 1)) {
      const dx = x + step * 64 + Phaser.Math.Between(-6, 6);
      const top = this.surface(dx, y - 8);
      if (top < 0) continue;
      const decal = this.decals[this.next];
      this.next = (this.next + 1) % DECALS;
      this.scene.tweens.killTweensOf(decal);
      decal
        .setTexture(`splat-${Phaser.Math.Between(0, 2)}`)
        .setPosition(Math.round(dx), top)
        .setFlipX(Math.random() < 0.5)
        .setAlpha(0)
        .setVisible(true);
      // The splat appears as the spray comes down on it.
      this.scene.tweens.add({ targets: decal, alpha: 1, duration: 80, delay: 150 + Math.abs(dx - x) * 3 });
    }
    if (big) this.splash();
  }

  /** The wizard gets a modest burst: the bugs are the target, he is never gore. */
  hit(x: number, y: number) {
    this.spray.explode(10, x, y);
  }

  private splash() {
    this.splashes.forEach(([blob, drip, ghost], side) => {
      const x = side ? WIDTH - Phaser.Math.Between(10, 50) : Phaser.Math.Between(10, 50);
      const y = Phaser.Math.Between(80, HEIGHT - 160);
      this.scene.tweens.killTweensOf([blob, drip, ghost]);
      blob.setPosition(x, y).setAlpha(0.85).setVisible(true);
      ghost
        .setPosition(x + (side ? -4 : 4), y - 2)
        .setAlpha(0.35)
        .setVisible(true);
      drip
        .setPosition(x + (side ? -12 : 12), y + 40)
        .setAlpha(0.85)
        .setVisible(true);
      const hide = () => {
        for (const part of [blob, drip, ghost]) part.setVisible(false);
      };
      this.scene.tweens.add({
        targets: [blob, ghost],
        alpha: 0,
        delay: 500,
        duration: 700,
        onComplete: hide,
      });
      this.scene.tweens.add({ targets: drip, y: y + 110, alpha: 0, duration: 1200, ease: "Quad.in" });
    });
  }
}
