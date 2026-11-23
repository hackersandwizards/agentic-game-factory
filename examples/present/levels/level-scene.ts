import Phaser from "phaser";
import { HEIGHT, PAD_X, PAD_Y, TINT, WIDTH } from "../design/tokens";
import { Run } from "../domain/run";
import { formatClock as clock, GOLD_TIME, POINTS, RANKS } from "../domain/score";
import { checkMap } from "../domain/map";
import { Terrain, TILE } from "../domain/terrain";
import { BugPatrol } from "../entities/bugs";
import { addDoor, openDoor } from "../entities/door";
import { addDust, FEEL, Wizard } from "../entities/wizard";
import { Blood, gore } from "../systems/blood";
import { LevelCamera } from "../systems/camera";
import { Juice } from "../systems/juice";
import { NightLight } from "../systems/light";
import { music } from "../systems/sound";
import { Bands } from "../ui/bands";
import { End } from "../ui/end";
import { Hint } from "../ui/hint";
import { Hud } from "../ui/hud";
import { listenForKonami } from "../ui/konami";
import { Popups } from "../ui/popups";
import { Touch } from "../ui/touch";
import { nextRankLines, WIN_PANEL_REACH, WinPanel } from "../ui/win-panel";
import { Layout } from "./layout";
import type { Level, LevelBackdrop } from "./level";
import { exposeState } from "./probes";
import { Reactions } from "./reactions";
import type { LevelRun } from "./reactions";

/**
 * The scene every level plays in: it builds a playable level from a `Level`, feeds what happens in Phaser to the
 * level's run and orders each frame. What the run announces, `Reactions` shows.
 */
export class LevelScene extends Phaser.Scene {
  player!: Wizard;
  layout!: Layout;
  backdrop!: LevelBackdrop;
  hudView!: Hud;
  run!: LevelRun;
  hint!: Hint;
  popups!: Popups;
  controls!: Touch;
  light!: NightLight;
  bugPatrol!: BugPatrol;
  blood?: Blood;
  private bands!: Bands;
  private juice!: Juice;
  private reactions!: Reactions;
  private readonly level: Level;
  private readonly terrain: Terrain;
  private readonly firstPit: number;
  private readonly cameraRig: LevelCamera;
  private readonly wizardBox = new Phaser.Geom.Rectangle(); // lateUpdate's scratch bounds
  private readonly brush = (x: number, y: number) => this.backdrop.brush(x, y);

  constructor(level: Level) {
    super(level.key);
    this.level = level;
    this.terrain = new Terrain(level.map, FEEL);
    checkMap(this.terrain.cells);
    this.firstPit = this.terrain.firstPit();
    this.cameraRig = new LevelCamera(this, this.terrain, FEEL);
    exposeState(this);
  }

  create() {
    this.light = new NightLight(this);
    this.cameraRig.reset();
    this.bands = new Bands(this);
    this.backdrop = this.level.backdrop(this);
    this.backdrop.addFar();

    this.layout = new Layout(this, this.terrain.cells, this.light);
    this.bugPatrol = new BugPatrol(this, this.terrain, this.bugPatrol?.smoothBugs);
    const dust = addDust(this);
    this.juice = new Juice(this);
    this.juice.addSparkles();
    const wizard = () => this.player.sprite;
    const place = (line: Phaser.GameObjects.Text, rise: number) => this.popups.place(line, rise);
    this.layout.place(this.bugPatrol, wizard, place);
    this.bugPatrol.trackSteps();
    const { start } = this.layout;
    const door = addDoor(this, start);

    this.player = new Wizard(this, start.x, start.y - TILE / 2, dust, this.terrain.ceilingAt);
    this.popups = new Popups(
      this,
      this.player,
      () => this.light.mask.depth + 1,
      () => this.hint,
      () => this.hudView.height,
    );
    this.light.add({ obj: this.player.glow, r: 1.4, tint: TINT.crystal, alpha: 0.9 });
    this.startRun();

    this.backdrop.addMiddle();
    this.juice.addShockwaves();
    this.bugPatrol.addCorpses();
    this.blood = gore
      ? new Blood(this, this.terrain.groundBelow.bind(this.terrain), (obj) => this.bands.ui(obj))
      : undefined;
    this.backdrop.addNear();
    this.light.addMask();

    this.addPlayUi();
    const { width, height, checkpoints, goal } = this.layout;
    const sights = [...checkpoints.trees, goal.sight];
    this.cameraRig.start(this.player, { start, width, height, sights, goal, panel: WIN_PANEL_REACH });
    music.start();
    listenForKonami(this, WIDTH, (confetti) => this.bands.ui(confetti));

    openDoor(this, door, this.player);
    this.trackFrames();
  }

  /** The run, and what feeds it: the wizard's touches as physics reports them, and the time a hidden tab took. */
  private startRun() {
    const { start, pickups, checkpoints, goal } = this.layout;
    const p = this.player;
    this.run = new Run({
      start: { x: start.x, y: start.y - TILE / 2 },
      crystals: pickups.total,
      checkpoints: checkpoints.trees.length,
      goal: goal.x,
    });
    goal.addPresent(start.x, start.y);
    const resume = (hidden: number) => this.run.skip(hidden);
    this.game.events.on(Phaser.Core.Events.RESUME, resume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(Phaser.Core.Events.RESUME, resume),
    );
    this.layout.collide(p, this.bugPatrol, {
      crystal: (crystal) => this.run.collect(crystal, crystal.getData("secret") as boolean),
      heart: (heart) => this.run.heal(heart),
      die: (die) => this.reactions.rollDie(die),
      bug: (bug) =>
        this.run.meet(bug, p.body, bug.body as Phaser.Physics.Arcade.Body, p.dashing, this.time.now),
    });
  }

  private addPlayUi() {
    this.hudView = new Hud(this, this.bands, this.run);
    this.hudView.addCanvas();
    this.hudView.watchResize(() => this.popups.clamp());
    this.cameraRig.syncHudHeight(this.hudView.height);
    this.updateHud();

    // Touch devices get four buttons; everyone gets one line on how to play. Both are "controls".
    const ended = () => this.run.won || this.run.gameOver;
    this.controls = new Touch(this, this.bands, (key, down) => this.player.setPad(key, down), ended);
    if (this.controls.available) this.controls.add();
    // The second line names the goals the win panel scores, before the first run ends.
    const help = `${this.controls.available ? "< > RUN, ^ JUMPS" : "ARROWS RUN, SPACE JUMPS"}, ${this.controls.dashKey} DASHES
UNDER ${clock(GOLD_TIME)} +${POINTS.gold}, RANK S AT ${RANKS[0][1]}`;
    this.bands.watchOrientation();
    this.bands.words("above", []);
    this.hint = new Hint(this, this.bands, help);

    this.reactions = new Reactions(this.run, {
      scene: this,
      wizard: this.player,
      bugs: this.bugPatrol,
      layout: this.layout,
      juice: this.juice,
      camera: this.cameraRig,
      blood: this.blood,
      bands: this.bands,
      hud: this.hudView,
      hint: this.hint,
      controls: this.controls,
      popups: this.popups,
      end: new End(this, this.bands, this.hudView, this.hint, this.controls),
      winPanel: new WinPanel(this),
    });
  }

  private trackFrames() {
    // Sprites follow their physics bodies after the physics step.
    const late = (_: number, delta: number) => this.lateUpdate(Math.min(delta, 50) / 1000);
    const back = () => this.bugPatrol.restoreBodies();
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, late);
    this.events.on(Phaser.Scenes.Events.PRE_UPDATE, back);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, late);
      this.events.off(Phaser.Scenes.Events.PRE_UPDATE, back);
      this.bands.destroy();
    });
  }

  update() {
    const { run, player: p } = this;
    // The win, checked during a hit-stop too: skipped there, a stomp just before the finish line once left him
    // stopping 48 px from the goal.
    run.arrive(p.sprite.x);
    // A hit-stop pauses the world, the bugs and the wizard (who thinks in its steps) with it. Keys pressed meanwhile
    // stay pending (JustDown) and count when it ends; drawing, sound and the HUD run on.
    this.hudView.updateTime(run.clock(this.time.now));
    if (this.physics.world.isPaused) return;
    run.step(p.grounded, p.dashing);
    if (this.terrain.fellOut(p.body.top)) this.hurt(true);
    this.bugPatrol.move();
    const px = p.sprite.x;
    if (!run.won && !run.gameOver) {
      if (this.hint.dismissOnMove(p.moved)) run.start(this.time.now);
      this.hint.teachDash(px, this.firstPit, this.controls.available);
    }
    const { checkpoints } = this.layout;
    for (const tree of checkpoints.trees) {
      run.pass(tree, px, tree.x, tree.lights.y - TILE / 2);
      checkpoints.shake(tree, px, this.time.now, this.brush);
    }
  }

  // After physics moved everything: sprites follow their bodies, the camera follows the wizard.
  private lateUpdate(dt: number) {
    const p = this.player;
    p.draw(dt);
    const held = this.physics.world.isPaused;
    if (!held) this.backdrop.advance(dt);
    this.bugPatrol.ageCorpses(held);
    this.cameraRig.follow(dt, held, this.controls.padRoom, this.hudView.height, this.run.won);
    const cam = this.cameras.main;
    const bottom = this.layout.height;
    this.layout.ground.setPlankDepth(p.body.bottom);
    this.bugPatrol.draw(this.cameraRig.camAt, cam, dt);
    if (!this.run.won) this.layout.goal.carry(p);
    // The camera reads the bounds before its final rounding of the sprite. Popups need the resulting position.
    const him = p.sprite.getBounds(this.wizardBox);
    this.popups.keepClear(him);
    this.hint.avoid(him, cam);
    const climb = Math.max(0, bottom - HEIGHT / 2 - (cam.scrollY + PAD_Y + HEIGHT / 2));
    const left = cam.scrollX + PAD_X;
    this.backdrop.draw(climb, left);
    this.light.draw(left, cam.scrollY);
  }

  popup(x: number, y: number, text: string, bounce = false, hold = 300) {
    this.popups.popup(x, y, text, { hold, bounce });
  }

  /** A hit, unless one already holds him: frozen, nothing touches him. */
  hurt(fall = false, from = 0) {
    if (!this.player.frozen) this.run.hurt(fall, from, this.time.now);
  }

  nextRank(this: Parameters<typeof nextRankLines>[0], gold: boolean) {
    return nextRankLines(this, gold);
  }

  seconds() {
    return this.run.seconds(this.time.now);
  }

  updateHud() {
    this.hudView.update();
  }
}
