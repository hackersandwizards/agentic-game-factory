import Phaser from "phaser";
import { ATLAS } from "../design/art";
import type { Cell, Cells } from "../domain/map";
import { TILE } from "../domain/terrain";
import type { BugKind, BugPatrol } from "../entities/bugs";
import { Checkpoints } from "../entities/checkpoints";
import { addEgg } from "../entities/eggs";
import type { EggKind } from "../entities/eggs";
import { Goal } from "../entities/goal";
import { Ground } from "../entities/ground";
import { Pickups } from "../entities/pickups";
import type { Wizard } from "../entities/wizard";
import type { NightLight } from "../systems/light";

type Report<T> = (touched: T) => void;

/** A level's map placed as the game's objects, one cell per 48 px tile (the cells: domain/map.ts). */
export class Layout {
  readonly width: number;
  readonly height: number;
  readonly ground: Ground;
  readonly pickups: Pickups;
  readonly checkpoints: Checkpoints;
  readonly goal: Goal;
  start = new Phaser.Math.Vector2();
  private readonly scene: Phaser.Scene;
  private readonly cells: Cells;
  private readonly light: NightLight;

  constructor(scene: Phaser.Scene, cells: Cells, light: NightLight) {
    this.scene = scene;
    this.cells = cells;
    this.light = light;
    this.width = cells[0].length * TILE;
    this.height = cells.length * TILE;
    this.ground = new Ground(scene, cells);
    this.pickups = new Pickups(scene, light);
    this.checkpoints = new Checkpoints(scene, light);
    this.goal = new Goal(scene, light, { dark: ATLAS.laptop, lit: ATLAS.laptopOn, gold: ATLAS.laptopGold });
  }

  /** Places every cell in reading order, which is also the order its objects draw in. */
  place(
    bugs: BugPatrol,
    wizard: () => Phaser.GameObjects.Sprite,
    line: (line: Phaser.GameObjects.Text, rise: number) => void,
  ) {
    // The cell being placed: its column and row, its centre and its bottom edge in px.
    const at = { x: 0, y: 0, px: 0, py: 0, bottom: 0 };
    const ground = (kind: "ground" | "plank" | "crate") => () =>
      this.ground.add(kind, at.x, at.y, at.px, at.py);
    const crystal = (secret: boolean) => () => this.pickups.addCrystal(at.x, at.px, at.py, secret);
    const bug = (kind: BugKind) => () => bugs.spawn(kind, at.px, at.py, this.light);
    const egg = (kind: EggKind) => () => addEgg(this.scene, kind, at.px, at.bottom, { wizard, place: line });
    const put: Record<Cell, (() => void) | undefined> = {
      air: undefined,
      ground: ground("ground"),
      plank: ground("plank"),
      crate: ground("crate"),
      crystal: crystal(false),
      secret: crystal(true),
      heart: () => this.pickups.addHeart(at.px, at.py),
      die: () => this.pickups.addDie(at.px, at.py),
      bug: bug("bug"),
      fast: bug("fast"),
      hop: bug("hop"),
      tree: () => this.checkpoints.add(at.px, at.bottom),
      door: () => (this.start = new Phaser.Math.Vector2(at.px, at.bottom)),
      goal: () => this.goal.add(at.px, at.bottom),
      cane: () => this.ground.addCane(at.px, at.bottom),
      terminal: egg("terminal"),
      ghost: egg("ghost"),
      sign: egg("sign"),
      neon: egg("neon"),
    };
    this.cells.forEach((row, y) =>
      row.forEach((cell, x) => {
        at.x = x;
        at.y = y;
        at.px = x * TILE + TILE / 2;
        at.py = y * TILE + TILE / 2;
        at.bottom = (y + 1) * TILE;
        put[cell]?.();
      }),
    );
  }

  /** What stops whom, and whom the wizard's touch is reported to. */
  collide(
    wizard: Wizard,
    bugs: BugPatrol,
    touch: {
      crystal: Report<Phaser.Physics.Arcade.Image>;
      heart: Report<Phaser.Physics.Arcade.Image>;
      die: Report<Phaser.Physics.Arcade.Image>;
      bug: Report<Phaser.Physics.Arcade.Sprite>;
    },
  ) {
    const { physics } = this.scene;
    physics.world.setBounds(0, 0, this.width, this.height + 128);
    physics.world.setBoundsCollision(true, true, false, false);
    wizard.body.setCollideWorldBounds(true);
    physics.add.collider(wizard.box, this.ground.solids);
    physics.add.collider(bugs.bugs, this.ground.solids);
    // While the wizard is frozen (hurt, GAME OVER, at the goal) nothing touches him.
    const awake = () => !wizard.frozen;
    const box = wizard.box;
    const { crystals, hearts, dice } = this.pickups;
    physics.add.overlap(box, crystals, (_, c) => touch.crystal(c as Phaser.Physics.Arcade.Image), awake);
    physics.add.overlap(box, hearts, (_, h) => touch.heart(h as Phaser.Physics.Arcade.Image), awake);
    physics.add.overlap(box, dice, (_, d) => touch.die(d as Phaser.Physics.Arcade.Image), awake);
    physics.add.overlap(box, bugs.bugs, (_, b) => touch.bug(b as Phaser.Physics.Arcade.Sprite), awake);
  }
}
