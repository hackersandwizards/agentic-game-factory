import Phaser from "phaser";
import { GRID_SCALE, REDUCED, TINT } from "../design/tokens";
import { sinceStep } from "./step";
import { sfx } from "../systems/sound";
import { WizardDrawing } from "./wizard/drawing";
import { approach, correctCorner, FEEL, V } from "./wizard/feel";

import type { Solid } from "./wizard/feel";

export { addDust } from "./wizard/dust";
export { FEEL } from "./wizard/feel";

const { JustDown } = Phaser.Input.Keyboard;

type Keys = Record<
  "left" | "right" | "a" | "d" | "up" | "w" | "space" | "x" | "shift",
  Phaser.Input.Keyboard.Key
>;

/** The wizard: an invisible physics box that moves, and a sprite that follows it and squashes. */
export class Wizard {
  readonly box: Phaser.GameObjects.Zone;
  readonly body: Phaser.Physics.Arcade.Body;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly glow: Phaser.GameObjects.Image;
  private readonly drawing: WizardDrawing;
  facing = 1;
  frozen = false;
  hit = false; // shows the hit pose until the respawn
  private walk = 0; // input while frozen, for scripted walks
  /** On-screen buttons (touch) and the autopilot test press these instead of keys. */
  pad = { left: false, right: false, jump: false, dash: false };
  /**
   * The dash is ready once per time in the air: landing from the air or squishing a bug refills it. A dash along
   * the ground keeps him on it, so standing there never refills: refilled on every grounded step, X pressed every
   * 0.35 s kept him at dash speed, and a cooldown only spaces that out, never below running speed. Leaving the
   * ground after a ground dash refills it once, so a dash on the run-up to a gap still leaves the air dash.
   */
  canDash = true;
  private aired = false; // in the air since the last dash, other than during a dash
  private groundDash = false; // the last dash started on the ground, and he has not left it since
  /** Whether he has run, jumped or dashed yet: the controls line stays and the run's time waits until then. */
  moved = false;
  private dashLeft = 0;
  private jumpHeld = false;
  private padJumpWas = false;
  private padDashWas = false;
  /**
   * A dash pressed since his last step. JustDown lost a press released before the step that would read it: Phaser's
   * key-up clears it. The touch buttons set it too (ui/touch.ts).
   */
  private dashQueued = false;
  private keys: Keys;
  private scene: Phaser.Scene;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private solid: Solid;
  private coyote = 0;
  private buffer = 0;
  private varJump = 0;
  private lastVy = 0;
  private wasGrounded = true;
  /**
   * The box's feet before and after the last physics step. Physics steps at a fixed 60 Hz, so a frame takes 0 or
   * 2 steps whenever frame times drift past the step; the sprite is drawn between the two, by how far time has
   * come toward the next step, and moves evenly (tests/perf.spec.ts). The test's control turns `smooth` off.
   */
  private from = new Phaser.Math.Vector2();
  private to = new Phaser.Math.Vector2();
  private at = new Phaser.Math.Vector2(); // between them, where draw() puts him before place() rounds it
  smooth = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dust: Phaser.GameObjects.Particles.ParticleEmitter,
    solid: Solid,
  ) {
    this.scene = scene;
    this.dust = dust;
    this.solid = solid;
    this.box = scene.add.zone(x, y, 8 * GRID_SCALE, 15 * GRID_SCALE);
    scene.physics.add.existing(this.box);
    this.body = this.box.body as Phaser.Physics.Arcade.Body;
    this.body.setMaxVelocityY(FEEL.maxFall);
    this.snap();
    // He thinks once per physics step, on the step's time, so his timers count the steps his speeds act on:
    // a held jump rises as high at 120 Hz as at 60 (tests/perf.spec.ts). A hit-stop, which a stomp starts inside
    // a step, pauses him from that step on.
    scene.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_STEP, (dt: number) => {
      this.from.copy(this.to);
      this.to.set(this.body.center.x, this.body.bottom);
      if (!scene.physics.world.isPaused) this.update(dt);
    });
    this.drawing = new WizardDrawing(scene, x, y);
    this.sprite = this.drawing.sprite;
    this.glow = this.drawing.glow;
    this.keys = scene.input.keyboard!.addKeys("left,right,a,d,up,w,space,x,shift") as Keys;
    for (const key of [this.keys.x, this.keys.shift]) key.on("down", () => (this.dashQueued = true));
  }

  get grounded() {
    return this.body.blocked.down;
  }

  get dashing() {
    return this.dashLeft > 0;
  }

  private update(dt: number) {
    const input = this.readRunInput();
    const jumpPressed = this.readJumpInput();
    const vx = this.run(input, dt);
    this.dash(input, jumpPressed, dt);
    this.drawing.markSnow(input, vx, dt, this, this.dust);
    this.jump(jumpPressed, dt);
    if (this.body.velocity.y < 0) correctCorner(this.body, this.box, this.solid, dt);
    this.land();
  }

  private readRunInput() {
    const k = this.keys;
    const pad = this.pad;
    const right = k.right.isDown || k.d.isDown || pad.right;
    const left = k.left.isDown || k.a.isDown || pad.left;
    return this.frozen ? this.walk : Number(right) - Number(left);
  }

  private readJumpInput() {
    const k = this.keys;
    const pad = this.pad;
    const jumpHeld = !this.frozen && (k.space.isDown || k.up.isDown || k.w.isDown || pad.jump);
    // Read every JustDown: each read clears its flag, so a short-circuit would leave one set.
    const space = JustDown(k.space);
    const up = JustDown(k.up);
    const w = JustDown(k.w);
    const jumpPressed = !this.frozen && (space || up || w || (pad.jump && !this.padJumpWas));
    this.padJumpWas = pad.jump;
    this.jumpHeld = jumpHeld;
    return jumpPressed;
  }

  private run(input: number, dt: number) {
    const body = this.body;
    // Run: accelerate toward the target speed, slower in the air.
    const mult = this.grounded ? 1 : FEEL.airMult;
    let vx = body.velocity.x;
    const over = Math.abs(vx) > FEEL.maxRun && Math.sign(vx) === input;
    vx = approach(vx, FEEL.maxRun * input, (over ? FEEL.runReduce : FEEL.runAccel) * mult * dt);
    body.setVelocityX(vx);
    if (input) this.facing = input;
    return vx;
  }

  private dash(input: number, jumpPressed: boolean, dt: number) {
    // Dash (Celeste): X, Shift or the pad's dash button bursts straight ahead while canDash
    // holds (when it refills: see canDash).
    // Afterwards the run's deceleration brings the speed back down, so the dash carries a little.
    const pad = this.pad;
    const body = this.body;
    const dashPressed = !this.frozen && (this.dashQueued || (pad.dash && !this.padDashWas));
    this.padDashWas = pad.dash;
    this.dashQueued = false;
    if ((input && !this.frozen) || jumpPressed || dashPressed) this.moved = true;
    if (dashPressed && this.canDash) {
      this.canDash = this.aired = false;
      this.groundDash = this.grounded;
      this.dashLeft = FEEL.dashTime;
      body.setAllowGravity(false);
      this.sprite.setScale(1.4, 0.7);
      if (!REDUCED) this.drawing.ghostTime = 0.25;
      sfx.dash();
    }

    this.advanceDash(dt);
  }

  private advanceDash(dt: number) {
    const body = this.body;
    if (this.dashLeft > 0) {
      body.setVelocity(this.facing * FEEL.dashSpeed, 0);
      this.dashLeft -= dt;
      if (this.dashLeft <= 0) this.endDash();
    } else if (!this.grounded) {
      this.aired = true;
      if (this.groundDash) this.canDash = true;
      this.groundDash = false;
    } else if (this.aired) this.canDash = true;
  }

  private jump(jumpPressed: boolean, dt: number) {
    // Jump: coyote time and buffer make it forgiving, holding it makes it higher.
    const body = this.body;
    const jumpHeld = this.jumpHeld;
    this.coyote = this.grounded ? FEEL.coyoteTime : this.coyote - dt;
    this.buffer = jumpPressed ? FEEL.jumpBuffer : this.buffer - dt;
    if (this.buffer > 0 && this.coyote > 0) {
      this.endDash();
      body.setVelocityY(-FEEL.jumpSpeed);
      this.varJump = FEEL.varJumpTime;
      this.buffer = this.coyote = 0;
      this.sprite.setScale(0.6, 1.4);
      this.dust.explode(4, this.sprite.x, this.sprite.y);
      sfx.jump();
    }
    // 0.2 s is twelve steps: a rounding crumb left after the twelfth must not hold a thirteenth.
    if (this.varJump > 1e-9) {
      if (jumpHeld) body.setVelocityY(Math.min(body.velocity.y, -FEEL.jumpSpeed));
      this.varJump = jumpHeld ? this.varJump - dt : 0;
    }
    const apex = Math.abs(body.velocity.y) < FEEL.halfGravThreshold && jumpHeld;
    body.setGravityY(apex ? -FEEL.gravity / 2 : 0);
  }

  private land() {
    // Land: squash by how fast we fell, puff of dust.
    if (this.grounded && !this.wasGrounded) {
      const squish = Math.min(this.lastVy / (240 * V), 1);
      this.sprite.setScale(Phaser.Math.Linear(1, 1.6, squish), Phaser.Math.Linear(1, 0.4, squish));
      this.dust.explode(3 + Math.round(squish * 4), this.sprite.x, this.sprite.y);
      if (squish > 0.3) sfx.land();
    }
    this.wasGrounded = this.grounded;
    this.lastVy = this.body.velocity.y;
  }

  /** Bounce off a stomped bug: higher while jump is held, and holding keeps rising like a jump. */
  bounce() {
    // maxFall caps the body's speed both ways, so the held bounce is that cap.
    this.body.setVelocityY(this.jumpHeld ? -FEEL.maxFall : -180 * GRID_SCALE);
    this.varJump = this.jumpHeld ? FEEL.varJumpTime : 0;
    this.sprite.setScale(0.7, 1.3);
    if (!REDUCED) this.drawing.ghostTime = 0.3;
  }

  /** Ends a dash early: a jump, a hit, the finish. */
  endDash() {
    this.dashLeft = 0;
    this.body.setAllowGravity(true);
  }

  freeze(held = true) {
    this.frozen = held;
  }

  scriptWalk(direction: number) {
    this.walk = direction;
  }

  setPad(key: keyof Wizard["pad"], down: boolean) {
    this.pad[key] = down;
    if (down && key === "dash") this.dashQueued = true;
  }

  rechargeDash() {
    this.canDash = true;
  }

  showHit() {
    this.hit = true;
  }

  finishRun() {
    this.freeze();
    this.scriptWalk(0);
    this.facing = 1;
    // A dash into the finish keeps no more than running speed, so he still brakes clear of the laptop.
    this.endDash();
    this.body.setVelocityX(Math.min(this.body.velocity.x, FEEL.maxRun));
    this.resetPose();
    this.hit = false;
  }

  respawnAt(x: number, y: number) {
    this.hit = false;
    this.moveTo(x, y);
    this.resetPose();
  }

  private resetPose() {
    // A hit's spin and blink stop here so the wizard is visible at the finish or when he resumes.
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setAngle(0).setAlpha(1);
  }

  /** A hit flashes the wizard white for three frames. */
  flash() {
    this.sprite.setTint(TINT.white).setTintMode(Phaser.TintModes.FILL);
    this.drawing.flashUntil = this.scene.time.now + 50;
  }

  /** Called after physics: the sprite follows the box and eases back from squash and stretch. */
  draw(dt: number) {
    const now = this.scene.time.now;
    const t = this.smooth ? sinceStep(this.scene.physics.world) : 1;
    this.at.set(Phaser.Math.Linear(this.from.x, this.to.x, t), Phaser.Math.Linear(this.from.y, this.to.y, t));
    this.place(0, 0);
    this.drawing.draw(this, now, dt);
  }

  place(ox: number, oy: number) {
    this.drawing.place(this.at.x, this.at.y, ox, oy, this.facing);
  }

  moveTo(x: number, y: number) {
    this.endDash();
    this.canDash = true;
    this.body.reset(x, y);
    this.body.setVelocity(0, 0);
    this.snap();
  }

  /** A jump in place, no slide: the sprite is drawn where the box now is. */
  private snap() {
    this.to.set(this.body.center.x, this.body.bottom);
    this.from.copy(this.to);
  }
}
