import Phaser from "phaser";
import { NIGHT_RGB, REDUCED } from "../design/tokens";
import { HIT_MS, INVULNERABLE_MS } from "../domain/combat";
import type { Run, RunEvents } from "../domain/run";
import type { BugPatrol } from "../entities/bugs";
import type { Tree } from "../entities/checkpoints";
import type { Wizard } from "../entities/wizard";
import type { Blood } from "../systems/blood";
import type { LevelCamera } from "../systems/camera";
import type { Juice } from "../systems/juice";
import { keepRecords } from "../systems/records";
import { sfx } from "../systems/sound";
import type { Bands } from "../ui/bands";
import type { End } from "../ui/end";
import type { Hint } from "../ui/hint";
import type { Hud } from "../ui/hud";
import type { Popups } from "../ui/popups";
import type { Touch } from "../ui/touch";
import type { WinPanel } from "../ui/win-panel";
import type { Layout } from "./layout";

// A respawn fades the world out and in over this many ms each.
const CUT_MS = 180;

type Pickup = Phaser.Physics.Arcade.Image;
type Bug = Phaser.Physics.Arcade.Sprite;
type Parts = { pickup: Pickup; bug: Bug; checkpoint: Tree };
export type LevelRun = Run<Parts>;
type Events = RunEvents<Parts>;

/** The parts of a level that show what its run announces. */
export type Cast = {
  scene: Phaser.Scene;
  wizard: Wizard;
  bugs: BugPatrol;
  layout: Layout;
  juice: Juice;
  camera: LevelCamera;
  blood?: Blood;
  bands: Bands;
  hud: Hud;
  hint: Hint;
  controls: Touch;
  popups: Popups;
  end: End;
  winPanel: WinPanel;
};

/**
 * What the level shows and plays when its run announces something: the one place where the run's events meet the
 * wizard, the bugs, the camera, the effects, the sound and the UI. Within an event the order is the order on screen.
 */
export class Reactions {
  private readonly run: LevelRun;
  private readonly cast: Cast;

  constructor(run: LevelRun, cast: Cast) {
    this.run = run;
    this.cast = cast;
    run.on("collected", (event) => this.collected(event));
    run.on("healed", (event) => this.healed(event));
    run.on("squished", (event) => this.squished(event));
    run.on("hurt", (event) => this.hurt(event));
    run.on("checkpoint", (event) => this.checkpoint(event));
    run.on("gameOver", () => this.gameOver());
    run.on("won", (event) => this.won(event));
  }

  private collected({ pickup, secret }: Events["collected"]) {
    const { layout, juice, hud } = this.cast;
    layout.pickups.take(pickup);
    juice.sparkle(secret ? 24 : 10, pickup.x, pickup.y);
    if (secret) sfx.secret();
    else sfx.crystal();
    hud.update();
    hud.flashCrystal();
  }

  private healed({ pickup }: Events["healed"]) {
    const { layout, juice, hud } = this.cast;
    hud.update();
    layout.pickups.take(pickup);
    juice.sparkle(10, pickup.x, pickup.y);
    sfx.crystal();
  }

  /** The d20 changes nothing in the run: it only shows. */
  rollDie(die: Pickup) {
    const { layout, juice, popups } = this.cast;
    layout.pickups.take(die);
    juice.sparkle(16, die.x, die.y);
    sfx.flourish();
    popups.popup(die.x, die.y - 24, "NAT 20!", { hold: 900 });
  }

  private squished({ bug, stomp, chain, points }: Events["squished"]) {
    const { wizard, bugs, juice, popups, camera, blood } = this.cast;
    const body = bug.body as Phaser.Physics.Arcade.Body;
    const corpse = bugs.squish(bug, body.bottom);
    const big = bugs.isBig(bug);
    bug.destroy();
    if (stomp) wizard.bounce();
    wizard.rechargeDash();
    juice.sparkle(8, bug.x, bug.y);
    // Above the wizard's head, or, as a stomp bounces him up there, beside him (`Popups.place`).
    const { sprite } = wizard;
    popups.popup(
      bug.x,
      Math.min(bug.y - 24, sprite.y - sprite.height),
      chain > 1 ? `+${points} x${chain}` : `+${points}`,
      { hold: 300, bounce: stomp, flat: corpse },
    );
    // Every kill holds the world 3 physics steps, a chain's later kills 4, so a stomp lands with weight: at 2 and no
    // shake, a single stomp on the low ground read as no freeze at all, the camera sitting on its bottom bound there.
    if (!REDUCED) juice.hitStop(Math.min(2 + chain, 4));
    // A shockwave ring at the bug's feet, and the camera kicks down with the stomp.
    juice.ring(bug.x, body.bottom);
    if (!REDUCED) camera.kick(6);
    // Every kill shakes, a chain's later ones harder, a hit (0.004) hardest: at 0.001, ±2 px, a stomp read as no shake.
    juice.shake(120 + 30 * chain, 0.0015 + 0.0005 * Math.min(chain, 4));
    if (blood) {
      blood.squish(bug.x, body.bottom, big);
      sfx.splat();
    } else sfx.stomp();
  }

  /**
   * A hit: spin and fade, then back to the last checkpoint (the door, or the last lit tree) and blink while
   * invulnerable. The last life ends the game.
   */
  private hurt({ fall, from }: Events["hurt"]) {
    const { scene, wizard: p, hud, blood, juice, camera } = this.cast;
    p.freeze();
    p.endDash();
    hud.update();
    hud.flashHeart(this.run.lives);
    p.flash();
    blood?.hit(p.sprite.x, p.sprite.y - 24);
    sfx.hurt();
    juice.hitStop(4);
    camera.holdForHit(fall, from);
    juice.shake(300, 0.004);
    p.showHit();
    juice.spin(p.sprite);
    scene.time.delayedCall(HIT_MS, () => {
      // He can slide over the finish line while the hit freezes him: then the win stands, and the hit ends there.
      if (!this.run.recover()) return;
      // Back at the checkpoint through a cut to the night and back, the input held until he shows again: the camera
      // panned up to 1200 px in a quarter second, and he could be steered off screen meanwhile. A plain cut with
      // reduced motion.
      const cam = scene.cameras.main;
      if (REDUCED) return this.respawn(fall);
      cam.fadeOut(CUT_MS, NIGHT_RGB.r, NIGHT_RGB.g, NIGHT_RGB.b);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        if (!this.run.won) this.respawn(fall, true);
        cam.fadeIn(CUT_MS, NIGHT_RGB.r, NIGHT_RGB.g, NIGHT_RGB.b);
        cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
          p.freeze(this.run.won);
          if (!this.run.won) this.shield();
        });
      });
    });
  }

  /** Puts him at the checkpoint and the camera on him at once; he moves again now, or with `held` after the fade-in. */
  private respawn(fall: boolean, held = false) {
    const { wizard: p, camera, juice, hint, controls } = this.cast;
    const { x, y } = this.run.checkpoint;
    p.respawnAt(x, y);
    camera.cutTo(x, y);
    juice.sparkle(12, x, y);
    p.freeze(held);
    if (!held) this.shield();
    // The gap after the last checkpoint is the one that needs the dash.
    if (fall && this.run.atLastCheckpoint) hint.show(`${controls.dashKey} DASHES`, 3000);
  }

  /** The blink after a respawn, from when he moves again: started at the cut, the fade-in ate a fifth of it. */
  private shield() {
    const { scene, wizard: p } = this.cast;
    this.run.shield(scene.time.now);
    if (REDUCED) {
      p.sprite.setAlpha(0.6);
      scene.time.delayedCall(INVULNERABLE_MS, () => p.sprite.setAlpha(1));
    } else scene.tweens.add({ targets: p.sprite, alpha: 0.3, duration: 100, yoyo: true, repeat: 4 });
  }

  // A Christmas tree lights up when he passes it and becomes the checkpoint.
  private checkpoint({ checkpoint: tree }: Events["checkpoint"]) {
    this.cast.layout.checkpoints.lightUp(tree);
    this.cast.juice.sparkle(20, tree.x, tree.lights.y - 104);
    sfx.lights();
  }

  private gameOver() {
    const { end, controls } = this.cast;
    end.showGameOver(this.run.crystals, this.run.totalCrystals, controls.available);
  }

  private won({ time, gold, awards }: Events["won"]) {
    const { wizard, bugs, layout, juice, camera, end, winPanel, controls, bands } = this.cast;
    const all = this.run.crystals === this.run.totalCrystals;
    camera.prepareWin();
    end.prepare(true);
    wizard.finishRun();
    bugs.retire();
    layout.goal.celebrate(all, (x, y) => juice.sparkle(12, x, y));
    const records = keepRecords(time, this.run.score);
    winPanel.showScore(this.run, { time, gold, awards, ...records }, controls.available, bands);
  }
}
