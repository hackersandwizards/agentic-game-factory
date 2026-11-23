import Phaser from "phaser";
import { REDUCED } from "../design/tokens";

export class Juice {
  private sparkles!: Phaser.GameObjects.Particles.ParticleEmitter;
  private shockwaves: Phaser.GameObjects.Image[] = [];

  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  addSparkles() {
    this.sparkles = this.scene.add.particles(0, 0, "spark", {
      frequency: -1,
      lifespan: 500,
      speed: { min: 60, max: 180 },
      scale: { start: 1, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
    });
    this.sparkles.setDepth(12);
  }

  sparkle(count: number, x: number, y: number) {
    this.sparkles.explode(count, x, y);
  }

  addShockwaves() {
    // The stomp's shockwave rings: a pool of three, reused in turn.
    this.shockwaves = Array.from({ length: 3 }, () =>
      this.scene.add.image(0, 0, "shockwave").setDepth(12).setVisible(false),
    );
  }

  ring(x: number, y: number) {
    const ring = this.shockwaves.find((w) => !w.visible) ?? this.shockwaves[0];
    ring.setPosition(x, y).setScale(0.4).setAlpha(1).setVisible(true);
    this.scene.tweens.add({
      targets: ring,
      scale: 1.6,
      alpha: 0,
      duration: 220,
      onComplete: () => ring.setVisible(false),
    });
  }

  /** Shakes the world camera, never the HUD, by up to intensity times the canvas width, easing out to still. */
  shake(ms: number, intensity: number) {
    if (REDUCED) return;
    const cam = this.scene.cameras.main.shake(ms, intensity, true);
    this.scene.tweens.add({ targets: cam.shakeEffect.intensity, x: 0, y: 0, duration: ms, ease: "Quad.out" });
  }

  /**
   * Pauses the world for `steps` physics steps. The clock resumes it before physics runs, so half a step more than the
   * steps' time resumes it on the frame after the last one held, whatever float crumbs the frame times leave. The whole
   * world holds, not only the bodies: every tween (popups rising, the ring, twinkles), every particle and the drifting
   * sky and mist (`Backdrop.advance`). With the bugs alone held, the snow and sparks moving on read as no freeze at all. A hopping
   * bug's hop keeps its time: moved on by each freeze, the bugs met the autopilot elsewhere and it lost lives at 60 Hz.
   */
  hitStop(steps: number) {
    const ms = ((steps + 0.5) * 1000) / this.scene.physics.world.fps;
    const emitters = this.scene.children.list.filter(
      (o) => o instanceof Phaser.GameObjects.Particles.ParticleEmitter,
    );
    const hold = (scale: number) => {
      this.scene.tweens.timeScale = scale;
      for (const emitter of emitters) emitter.timeScale = scale;
    };
    this.scene.physics.pause();
    hold(0);
    this.scene.time.delayedCall(ms, () => {
      this.scene.physics.resume();
      hold(1);
    });
  }

  spin(sprite: Phaser.GameObjects.Sprite) {
    // He fades only in the spin's second half: fading all along, he was mostly gone while he spun. With reduced motion
    // over the whole of it.
    const fade = REDUCED ? 0 : 175;
    this.scene.tweens.add({ targets: sprite, angle: 360, duration: 350 });
    this.scene.tweens.add({ targets: sprite, alpha: 0, delay: fade, duration: 350 - fade });
  }
}
