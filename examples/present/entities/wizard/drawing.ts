import Phaser from "phaser";
import { addGlow, ATLAS } from "../../design/art";
import { GRID_SCALE, REDUCED, TINT, ZOOM } from "../../design/tokens";
import { approach, FEEL } from "./feel";

// The staff's crystal in the wizard's frames, from the sprite's bottom centre facing right.
const STAFF_TIP = { x: 30, y: -70 };
type Pose = {
  body: Phaser.Physics.Arcade.Body;
  grounded: boolean;
  facing: number;
  hit: boolean;
  canDash: boolean;
};

/** Registers the wizard's animations with the game, once: every scene that draws him shares them. */
function addAnimations(scene: Phaser.Scene) {
  if (scene.anims.exists("idle")) return;
  const anim = (key: string, frames: string[], frameRate: number) =>
    scene.anims.create({
      key,
      frames: frames.map((frame) => ({ key: "atlas", frame })),
      frameRate,
      repeat: -1,
    });
  const { idle, blink: shut, run, jump, fall, hit } = ATLAS.wizard;
  // Idle holds its pose and blinks once every few seconds; the breathing is a sine in `easeScaleAndTint`.
  scene.anims.create({
    key: "idle",
    frames: [
      { key: "atlas", frame: idle, duration: 3200 },
      { key: "atlas", frame: shut, duration: 140 },
    ],
    repeat: -1,
  });
  anim("run", run, 14);
  anim("jump", [jump], 1);
  anim("fall", [fall], 1);
  anim("hit", [hit], 1);
}

export class WizardDrawing {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly glow: Phaser.GameObjects.Image;
  /** Afterimages behind a bounce, and footprints in the snow: pools, reused in turn. */
  private readonly ghosts: Phaser.GameObjects.Image[];
  private readonly prints: Phaser.GameObjects.Image[];
  ghostTime = 0;
  private ghostNext = 0;
  private dustTimer = 0;
  private printTimer = 0;
  private printNext = 0;
  private printSide = 1;
  flashUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    addAnimations(scene);
    this.sprite = scene.add.sprite(x, y, "atlas", ATLAS.wizard.idle).setOrigin(0.5, 1).setDepth(10);
    this.sprite.play("idle");
    this.glow = addGlow(scene, x, y, TINT.crystal).setDepth(11);
    this.ghosts = Array.from({ length: 4 }, () =>
      scene.add
        .image(x, y, "atlas", ATLAS.wizard.idle)
        .setOrigin(0.5, 1)
        .setDepth(9)
        .setTint(TINT.crystal)
        .setTintMode(Phaser.TintModes.FILL)
        .setVisible(false),
    );
    this.prints = Array.from({ length: 12 }, () =>
      scene.add.image(x, y, "footprint").setOrigin(0.5, 1).setDepth(2).setVisible(false),
    );
  }

  draw(state: Pose, now: number, dt: number) {
    this.easeScaleAndTint(state, now, dt);
    this.drawTrail(now, dt);
    this.drawPose(state, now);
  }

  private easeScaleAndTint(state: Pose, now: number, dt: number) {
    const s = this.sprite;
    // Standing still he breathes: 2 % taller and back every 3 s, from his feet.
    const still =
      state.grounded && Math.abs(state.body.velocity.x) <= 10 * GRID_SCALE && !state.hit && !REDUCED;
    const breath = still ? 1 + 0.02 * Math.sin(now / 480) : 1;
    s.setScale(approach(s.scaleX, 1, 4 * dt), approach(s.scaleY, breath, 4 * dt));
    if (this.flashUntil && now > this.flashUntil) {
      s.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      this.flashUntil = 0;
    }
  }

  private drawTrail(now: number, dt: number) {
    const s = this.sprite;
    this.ghostTime -= dt;
    if (this.ghostTime > 0 && now > this.ghostNext) {
      const ghost = this.ghosts[Math.floor(now / 60) % this.ghosts.length];
      ghost.setFrame(s.frame.name).setPosition(s.x, s.y).setFlipX(s.flipX).setAlpha(0.5).setVisible(true);
      this.ghostNext = now + 60;
    }
    for (const ghost of this.ghosts)
      if (ghost.visible) ghost.setAlpha(ghost.alpha - 2.5 * dt).setVisible(ghost.alpha > 0);
    for (const print of this.prints)
      if (print.visible) print.setAlpha(print.alpha - 0.3 * dt).setVisible(print.alpha > 0);
  }

  private drawPose(state: Pose, now: number) {
    const s = this.sprite;
    s.setFlipX(state.facing < 0);
    if (state.hit) s.play("hit", true);
    else if (!state.grounded) s.play(state.body.velocity.y < 0 ? "jump" : "fall", true);
    // Pushing against a wall he stands: the run kept his legs going in place.
    else {
      const wall = state.facing > 0 ? state.body.blocked.right : state.body.blocked.left;
      s.play(Math.abs(state.body.velocity.x) > 10 * GRID_SCALE && !wall ? "run" : "idle", true);
    }
    // The staff shows the dash: its teal light dims to grey while the dash is spent.
    this.glow.setTint(state.canDash ? TINT.crystal : TINT.dim);
    this.glow.setAlpha((state.canDash ? 0.5 : 0.25) + (REDUCED ? 0 : 0.15 * Math.sin(now / 200)));
  }

  markSnow(
    input: number,
    vx: number,
    dt: number,
    state: Pose,
    dust: Phaser.GameObjects.Particles.ParticleEmitter,
  ) {
    // Dust: a puff now and then while running fast, a burst when turning around (skid).
    const skid = state.grounded && input !== 0 && Math.sign(vx) === -input && Math.abs(vx) > 40 * GRID_SCALE;
    const running = state.grounded && Math.abs(vx) > FEEL.maxRun * 0.8;
    this.dustTimer -= dt;
    this.leaveFootprint(dt, vx, state.body);
    if ((skid || running) && this.dustTimer <= 0) {
      dust.explode(skid ? 3 : 1, this.sprite.x - state.facing * 4 * GRID_SCALE, this.sprite.y);
      this.dustTimer = skid ? 0.05 : 0.15;
    }
  }

  private leaveFootprint(dt: number, vx: number, body: Phaser.Physics.Arcade.Body) {
    const { sprite } = this;
    // Footprints: one every few steps while running on the ground, left and right foot in turn.
    this.printTimer -= dt;
    if (body.blocked.down && Math.abs(vx) > FEEL.maxRun * 0.5 && this.printTimer <= 0) {
      const print = this.prints[this.printNext];
      this.printNext = (this.printNext + 1) % this.prints.length;
      this.printSide = -this.printSide;
      print
        .setPosition(sprite.x + this.printSide * 4, body.bottom)
        .setAlpha(0.8)
        .setVisible(true);
      this.printTimer = 0.16;
    }
  }

  /**
   * Puts the sprite, and the staff's glow, on whole screen pixels, half an art pixel: the frame's left edge and his
   * feet. On whole art pixels his step at 60 Hz alternated 5 and 6 art pixels and wobbled 2 screen pixels against
   * the camera. The camera draws on whole screen pixels too but eases between them: (ox, oy) is how far it was
   * rounded, so he is rounded once, against where the camera eases, and moves as evenly as against a smooth one.
   */
  place(x: number, feet: number, ox: number, oy: number, facing: number) {
    const s = this.sprite;
    const half = (s.width / 2) % 1;
    // A spin (a hit) turns him about his frame's centre, held where the turned frame's lowest corner meets the ground
    // he stood on, rounded up off it. Turned about his feet, the origin, he went up to his whole height into the floor.
    const h = s.displayHeight / 2;
    const sin = Math.sin(s.rotation);
    const cos = Math.cos(s.rotation);
    const y = feet - h * Math.abs(cos) - (s.displayWidth / 2) * Math.abs(sin) + h * cos;
    s.setPosition(
      Math.round((x - half - h * sin + ox) * ZOOM) / ZOOM + half,
      s.rotation ? Math.floor(y * ZOOM) / ZOOM : Math.round((y + oy) * ZOOM) / ZOOM,
    );
    this.glow.setPosition(s.x + facing * STAFF_TIP.x, s.y + STAFF_TIP.y);
  }
}
