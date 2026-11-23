import Phaser from "phaser";
import { ATLAS } from "../design/art";
import { GRID_SCALE, REDUCED, TINT } from "../design/tokens";
import { sinceStep } from "./step";
import type { Terrain } from "../domain/terrain";
import type { NightLight } from "../systems/light";

// A hopping bug crouches this long before each hop. At 250 ms, about a player's reaction time, the bug on the
// step before the crate pyramid hopped into a wizard jumping up to it before he could see it coming.
const HOP_WARN = 400;
// It hops every HOP_EVERY ms, sinking into a crouch of CROUCH (width, height) over the HOP_WARN before, and rises out
// of it over the HOP_EASE after: held at once and dropped at the hop, the crouch read as a flattened bug that popped up.
const HOP_EVERY = 1400;
const HOP_EASE = 150;
const CROUCH = { x: 0.15, y: 0.2 };
// A bug's walk is two poses, swapped every `step` art px it travels, so its feet keep up with the ground at any speed:
// at a fixed 6 fps the bug slid 15 art px per pose (the fast one 30) and looked stiff. 9 px holds a pose 6 frames at
// 60 Hz; the fast bug's 15 px holds one 5 frames, 12 poses a second: at 9 px it swapped every 3 frames and, bobbing
// each pose, buzzed. It scuttles level instead. A walking bug dips `dip` art px on each footfall and comes back up a
// pixel a frame: a dip that snapped back in one frame read as a twitch. On whole art pixels, as the drawn size is:
// half a pixel blurred every edge of the shell. Turning, it pinches by TURN for TURN_MS.
const TURN = 0.2;
const TURN_MS = 150;
// `big`: its squish splashes the screen in 18+ mode.
const BUGS = {
  bug: { speed: 30 * GRID_SCALE, hops: false, step: 9, dip: 2, big: false },
  fast: { speed: 60 * GRID_SCALE, hops: false, step: 15, dip: 0, big: true },
  hop: { speed: 30 * GRID_SCALE, hops: true, step: 9, dip: 2, big: true },
};
export type BugKind = keyof typeof BUGS;

// A squished bug lies flat this many drawn frames of the running world before it vanishes. It flashes white the frame
// it is squished, then lies screened with the snow's pale blue: in its own dark colours it barely showed on the ground.
const SQUISHED = 3;
const SQUISHED_TINT = TINT.snowShade;
// A bug's last physics step, how far it is drawn back from its body, how far it has walked, its pose, the facing and
// turn it is drawn with, and its kind's step, dip and hops (BUGS).
type Walk = {
  bug: Phaser.Physics.Arcade.Sprite;
  step: number;
  dip: number;
  hops: boolean;
  dx: number;
  dy: number;
  ox: number;
  oy: number;
  frames: string[];
  walked: number;
  pose: number;
  flip: boolean;
  turn: number;
};

export class BugPatrol {
  bugs!: Phaser.Physics.Arcade.Group;
  walks: Walk[] = [];
  corpses: Phaser.GameObjects.Image[] = []; // squished bugs lying flat, a pool
  private corpseFrames: number[] = [];
  private corpseFrom: number[] = []; // the game frame each was squished in: it shows white in that one
  smoothBugs = true; // the judder test's control turns it off, as wizard.ts's smooth

  private readonly scene: Phaser.Scene;
  private readonly terrain: Terrain;

  constructor(scene: Phaser.Scene, terrain: Terrain, smoothBugs = true) {
    this.scene = scene;
    this.terrain = terrain;
    this.smoothBugs = smoothBugs;
    this.bugs = scene.physics.add.group({ maxVelocityY: 600 });
  }

  spawn(kind: BugKind, px: number, py: number, light: NightLight) {
    const bug = this.bugs.create(px, py, "atlas", ATLAS[kind][0]) as Phaser.Physics.Arcade.Sprite;
    bug
      .setData(BUGS[kind])
      .setData("kind", kind)
      .setData("nextHop", this.scene.time.now + HOP_EVERY)
      .setData("dir", -1)
      .setVelocityX(-BUGS[kind].speed);
    // The body is the shell at the frame's bottom: legs and antennae stick out of it.
    light.add({ obj: bug, r: 0.8, tint: TINT.danger, alpha: 0.5 }); // danger keeps its magenta at night
    bug
      .body!.setSize(13 * GRID_SCALE, 9 * GRID_SCALE)
      .setOffset((bug.width - 13 * GRID_SCALE) / 2, bug.height - 9 * GRID_SCALE);
  }

  trackSteps() {
    // Bugs are drawn between their last two physics steps, as the wizard is (wizard.ts and wizard/drawing.ts), or a bug stands still
    // on frames without a step and jumps two steps on frames with two: lateUpdate draws each its last step
    // times (1 - t) behind its body, and the next frame's preupdate puts it back before physics reads it.
    this.walks = (this.bugs.getChildren() as Phaser.Physics.Arcade.Sprite[]).map((bug) => ({
      bug,
      step: bug.getData("step") as number,
      dip: bug.getData("dip") as number,
      hops: bug.getData("hops") as boolean,
      dx: 0,
      dy: 0,
      ox: 0,
      oy: 0,
      frames: ATLAS[bug.getData("kind") as BugKind],
      walked: 0,
      pose: 0,
      flip: false,
      turn: 0,
    }));
    this.scene.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_STEP, () => {
      for (const walk of this.walks) {
        const body = walk.bug.body as Phaser.Physics.Arcade.Body | null;
        walk.dx = body?.enable ? body.x - body.prev.x : 0;
        walk.dy = body?.enable ? body.y - body.prev.y : 0;
        walk.walked += Math.abs(walk.dx);
      }
    });
  }

  addCorpses() {
    this.corpses = Array.from({ length: 3 }, () =>
      this.scene.add.image(0, 0, "atlas", ATLAS.bug[0]).setOrigin(0.5, 1).setVisible(false),
    );
    this.corpseFrames = [0, 0, 0];
    this.corpseFrom = [0, 0, 0];
  }

  restoreBodies() {
    for (const walk of this.walks) {
      walk.bug.x += walk.ox;
      walk.bug.y += walk.oy;
      walk.ox = walk.oy = 0;
      walk.bug.setScale(1);
    }
  }

  move() {
    for (const bug of this.bugs.getChildren() as Phaser.Physics.Arcade.Sprite[]) this.moveBug(bug);
  }

  /** Bugs walk until a wall or the edge of their ground, then turn. Hopping bugs hop now and then. */
  private moveBug(bug: Phaser.Physics.Arcade.Sprite) {
    const body = bug.body as Phaser.Physics.Arcade.Body;
    const speed = bug.getData("speed") as number;
    // The heading is kept, not read off the velocity: a wall zeroes velocity.x, and a bug that read 0 as
    // "left" walked back into a wall on its right for good. Only the wall ahead counts: blocked stays set
    // until the next physics step, and on a frame without one the bug would turn back into the wall.
    let dir = bug.getData("dir") as number;
    if (body.blocked.down) {
      const ahead = dir > 0 ? body.right + 2 : body.left - 8;
      const ground = this.terrain.solidAt(ahead, body.bottom + 2, 6, 12);
      if (!ground || (dir > 0 ? body.blocked.right : body.blocked.left)) bug.setData("dir", (dir = -dir));
      bug.setVelocityX(dir * speed);
      if (bug.getData("hops")) {
        // A hop is announced: the bug crouches for HOP_WARN ms before it jumps (stepBug draws it).
        if (bug.getData("nextHop") <= this.scene.time.now)
          bug.setVelocityY(-200 * GRID_SCALE).setData("nextHop", this.scene.time.now + HOP_EVERY);
      }
    }
    bug.setFlipX(dir > 0);
  }

  /**
   * A bug's pose from how far it has walked, drawn between steps as its body is, its dip on each footfall, its turn and
   * a hopping bug's crouch: only the drawing, from the feet, in walk.oy and its scale, which the next frame puts back.
   */
  private stepBug(walk: Walk, behind: number, dt: number) {
    const bug = walk.bug;
    const steps = (walk.walked - behind) / walk.step;
    const pose = Math.floor(steps) % 2;
    if (pose !== walk.pose) bug.setFrame(walk.frames[(walk.pose = pose)]);
    walk.turn = bug.flipX !== walk.flip && !REDUCED ? TURN_MS : Math.max(0, walk.turn - dt * 1000);
    walk.flip = bug.flipX;
    const crouch = walk.hops ? this.crouch(bug) : 0;
    const turn = (TURN * walk.turn) / TURN_MS;
    const w = bug.width;
    const h = bug.height;
    const high = Math.round(h * (1 - CROUCH.y * crouch + turn / 4));
    bug.setScale(Math.round(w * (1 + CROUCH.x * crouch - turn)) / w, high / h);
    walk.oy += (high - h) / 2;
    if (!REDUCED && walk.dx && (bug.body as Phaser.Physics.Arcade.Body).blocked.down)
      walk.oy -= Math.round(walk.dip * (1 - Math.sin(Math.PI * (steps % 1))));
  }

  /** How deep a hopping bug crouches, 0 to 1: sinking over the HOP_WARN before a hop, rising over the HOP_EASE after. */
  private crouch(bug: Phaser.Physics.Arcade.Sprite) {
    const wait = (bug.getData("nextHop") as number) - this.scene.time.now;
    if (wait < HOP_WARN) return Math.min(1, 1 - wait / HOP_WARN);
    return Math.max(0, 1 - (HOP_EVERY - wait) / HOP_EASE);
  }

  /** Whether a bug is one of the big kinds. Ask before it is destroyed: a destroyed sprite answers getData with undefined. */
  isBig(bug: Phaser.Physics.Arcade.Sprite) {
    return bug.getData("big") as boolean;
  }

  squish(bug: Phaser.Physics.Arcade.Sprite, bottom: number) {
    // It lies flat for a moment where it was squished, the burst on top. `ageCorpses` counts down its visible frames.
    const corpse = this.corpses.find((c) => !c.visible) ?? this.corpses[0];
    const i = this.corpses.indexOf(corpse);
    corpse
      .setFrame(bug.frame.name)
      .setFlipX(bug.flipX)
      .setPosition(bug.x, bottom)
      .setScale(1.4, 0.4)
      .setTint(TINT.white)
      .setTintMode(Phaser.TintModes.FILL)
      .setVisible(true);
    this.corpseFrames[i] = SQUISHED;
    this.corpseFrom[i] = this.scene.game.loop.frame;
    return corpse;
  }

  /** The win scene is the wizard's and the laptop's: every bug stops where it stands and fades out. */
  retire() {
    const bugs = this.bugs.getChildren();
    this.scene.physics.world.disable(bugs);
    if (bugs.length)
      this.scene.tweens.add({
        targets: bugs,
        alpha: 0,
        duration: 400,
        onComplete: () => this.bugs.clear(true, true),
      });
  }

  ageCorpses(held: boolean) {
    for (let i = 0; i < this.corpses.length; i++) {
      const corpse = this.corpses[i];
      if (!corpse.visible) continue;
      if (this.scene.game.loop.frame > this.corpseFrom[i] && corpse.tintMode === Phaser.TintModes.FILL)
        corpse.setTint(SQUISHED_TINT).setTintMode(Phaser.TintModes.SCREEN);
      if (!held && --this.corpseFrames[i] < 0) corpse.setVisible(false);
    }
  }

  draw(at: Phaser.Math.Vector2, cam: Phaser.Cameras.Scene2D.Camera, dt: number) {
    // The bugs between their steps, against where the camera eases, off the whole pixels he and the camera draw on:
    // rounded too, a bug stepped a screen pixel more or less now and then and looked stiff (the judder tests).
    const t = this.smoothBugs ? sinceStep(this.scene.physics.world) : 1;
    for (const walk of this.walks) {
      walk.ox = (1 - t) * walk.dx + at.x - cam.scrollX;
      walk.oy = (1 - t) * walk.dy + at.y - cam.scrollY;
      if (walk.bug.active) this.stepBug(walk, (1 - t) * Math.abs(walk.dx), dt);
      walk.bug.x -= walk.ox;
      walk.bug.y -= walk.oy;
    }
  }
}
