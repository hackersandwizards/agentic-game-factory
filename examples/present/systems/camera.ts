import Phaser from "phaser";
import { HEIGHT, HW, NIGHT_RGB, REDUCED, WIDTH, ZOOM } from "../design/tokens";
import { TILE } from "../domain/terrain";
import type { Terrain } from "../domain/terrain";

const HEADROOM = 240; // world pixels the camera may show above the level's top
// The view's lead in the run direction: he stands LEAD px left of the view's centre, 37.5 % of its width, and his run
// speed times LAG more makes up for the camera's two eased steps (at 60 Hz 19 and 9 frames behind a steady run).
// Led by his facing alone, 96 px, he sat at 56 % of the view running right and at up to 80 %.
const LEAD = 120;
const LAG = 28 / 60; // s
// The eased part of the camera's vertical move is at most CAM_STEP world px per 60 Hz frame, just over his fastest
// fall (14 px): the look-down at a ledge once moved the view 40 px in one frame.
const CAM_STEP = 16;
// Whom the camera follows, and what it reads of the level: its size, where he starts, the sights it leans toward
// as he comes near (checkpoints, the goal), the goal it settles by at the win and how far into the view from its left
// edge the win's panel reaches.
type Followed = {
  body: Phaser.Physics.Arcade.Body;
  sprite: Phaser.GameObjects.Sprite;
  facing: number;
  grounded: boolean;
  hit: boolean;
  place(ox: number, oy: number): void;
};
type Stage = {
  start: { x: number; y: number };
  width: number;
  height: number;
  sights: readonly { x: number }[];
  goal: { x: number };
  panel: number;
};
export class LevelCamera {
  private camTarget = new Phaser.Math.Vector2();
  camAt = new Phaser.Math.Vector2(); // eased scroll before `draw` rounds it
  private slack = 0; // head-room correction in `draw` after a change in HUD height or respawn
  private hudWas = 0; // the room the HUD took last frame
  private respawned = false;
  private standY = 0; // where the wizard's feet last stood
  private lead = 0; // px the view leads him by for his speed (LAG), eased

  private readonly scene: Phaser.Scene;
  private readonly terrain: Terrain;
  private readonly wizardBox = new Phaser.Geom.Rectangle();
  private readonly feel: { maxRun: number; jumpSpeed: number };
  private wizard!: Followed;
  private stage!: Stage;

  constructor(scene: Phaser.Scene, terrain: Terrain, feel: { maxRun: number; jumpSpeed: number }) {
    this.scene = scene;
    this.terrain = terrain;
    this.feel = feel;
  }

  reset() {
    this.slack = 0;
    this.respawned = false;
  }

  start(wizard: Followed, stage: Stage) {
    this.wizard = wizard;
    this.stage = stage;
    const { start, width, height } = stage;
    const cam = this.scene.cameras.main;
    // `draw` lets the view above the world only to give the wizard's head room.
    cam.setBounds(0, -HEADROOM, width, height + HEADROOM).setZoom(ZOOM);
    this.camTarget.set(start.x, start.y - TILE);
    cam.centerOn(this.camTarget.x, this.camTarget.y);
    this.camAt.set(cam.scrollX, cam.scrollY);
    cam.setBackgroundColor(HW.night).fadeIn(500, NIGHT_RGB.r, NIGHT_RGB.g, NIGHT_RGB.b); // the canvas itself is transparent
  }

  syncHudHeight(height: number) {
    this.hudWas = height;
  }

  follow(dt: number, held: boolean, padRoom: number, hud: number, won: boolean) {
    const ease = held ? 0 : 1 - Math.pow(0.9, dt * 60);
    this.followX(won, ease);
    const drop = this.followY(padRoom);
    this.draw(dt, ease, drop, hud);
  }

  private followX(won: boolean, ease: number) {
    const p = this.wizard;
    // Look ahead in the running direction (LEAD); follow vertically only on landing or when falling far.
    // The smoothing factor depends on dt, so the camera feels the same at 60 and at 144 Hz. A hit-stop holds it, kick
    // included; only his head's limit (below) still moves it.
    // Near a tree or the goal the camera leans 35 % toward it, so the moment stays in frame. A dash leads no further
    // than a run: the camera would swing out and back.
    // His speed changes once a physics step, which a frame takes 0 or 2 of: eased, the lead does not jerk the view (the
    // bugs' judder test, p95 0.62 px at 57 Hz uneased).
    const run = Phaser.Math.Clamp(p.body.velocity.x, -this.feel.maxRun, this.feel.maxRun);
    this.lead = Phaser.Math.Linear(this.lead, run * LAG, ease / 2);
    let aim = p.sprite.x + p.facing * LEAD + this.lead;
    for (const sight of this.stage.sights)
      if (Math.abs(p.sprite.x - sight.x) < 120) aim = Phaser.Math.Linear(aim, sight.x, 0.35);
    const { goal, panel } = this.stage;
    // At the win the camera settles between the wizard and the goal, so present, screen and fountain all show, and
    // left enough that his frame stands 24 px clear of the panel: held at the level's end, the view had his scarf on
    // the panel's border.
    if (won) aim = Math.min(goal.x - 40, p.sprite.x - p.sprite.width / 2 - panel - 24 + WIDTH / 2);
    this.camTarget.x = Phaser.Math.Linear(this.camTarget.x, aim, ease / 2);
  }

  private followY(padRoom: number) {
    const p = this.wizard;
    // In the air coming down on ground well below where he last stood, the camera looks down until that ground shows
    // 48 px above the view's bottom (above the sideways touch pad: padRoom), as far as his head allows (below): off the
    // high route it showed a sliver of snow. Into a pit it looks down to the level's bottom once he falls 48 px below
    // his last footing. Only coming down: started at the take-off, the look-down dropped the view 40 px in a frame and
    // his rising head pulled it back up. Only ever further down: past the apex of a bounce off the hopping bug's step,
    // aimed at his feet above where he had stood, it rose 37.5 px while he fell and then dropped 57.
    // From a hit to the respawn it holds (the level's hurt reaction): hit by the hopping bug in a jump off the high route, the look-down
    // the jump had started went on 121 px while he dropped back onto the route, and came back up.
    if (p.grounded) this.standY = p.sprite.y;
    const land = this.terrain.landing(p.body.center.x, p.body.bottom, p.body.velocity.x, p.body.velocity.y);

    const drop =
      !p.hit &&
      !p.grounded &&
      p.body.velocity.y >= 0 &&
      (land > this.standY + TILE || (land < 0 && p.sprite.y > this.standY + TILE));
    // Sideways on a touch screen the larger of the two set that ground on the pad's edge, where the eased view crept
    // for 27 frames off the first high ledge.
    const margin = TILE + padRoom;
    if (drop)
      this.camTarget.y = Math.max(
        this.camTarget.y,
        p.sprite.y - TILE,
        (land < 0 ? this.stage.height : land) + margin - HEIGHT / 2,
      );
    else if (!p.hit && (p.grounded || p.sprite.y > this.camTarget.y + 120))
      this.camTarget.y = p.sprite.y - TILE;
    return drop;
  }

  private draw(dt: number, ease: number, drop: boolean, hud: number) {
    const p = this.wizard;
    // The zoomed camera's scroll puts the view's centre at scroll + half the canvas. The camera eases in camAt and
    // draws on whole screen pixels: between them every edge of the world and the layers blurred while it moved.
    const cam = this.scene.cameras.main;
    const at = this.camAt;
    at.x = cam.clampX(Phaser.Math.Linear(at.x, this.camTarget.x - cam.width / 2, ease));
    // The view stops at the world's top, but wherever the wizard's head comes within 4 px of the HUD's bottom
    // edge, the view follows it up. scrollY plus offset is the view's top edge. Where that limit jumps without him
    // moving (the HUD turning on as the phone turns, a respawn above the view), it lags by the jump and catches up at
    // twice his jump speed: the camera jumped up to 56 px in one frame. His own moves, a stomp's stretch included,
    // it follows at once, or the HUD covers his head. His frame's top as drawn: spinning from a hit, its corners rose
    // 2 px under the HUD.
    const offset = (cam.height - cam.height / ZOOM) / 2;

    const head = p.sprite.getBounds(this.wizardBox).y - 4 - hud - offset;
    this.slack = Math.max(0, this.slack - 2 * this.feel.jumpSpeed * dt) + Math.max(0, hud - this.hudWas);
    if (this.respawned) this.slack = Math.max(0, at.y - head);
    this.hudWas = hud;
    this.respawned = false;
    // Looking down it eases four times as fast, or the fall outran it and the landing showed as he reached it: at
    // twice, walking off the high route, the strip showed 47 of its 48 px with his feet 172 px above it, and at three
    // times under the CAM_STEP cap all 48 only with them 171.8 px above it.
    const step = CAM_STEP * dt * 60;
    const eased = Phaser.Math.Linear(at.y, this.camTarget.y - cam.height / 2, drop ? 4 * ease : ease);
    at.y = Math.min(
      cam.clampY(Math.max(Phaser.Math.Clamp(eased, at.y - step, at.y + step), -offset)),
      head + this.slack,
    );
    cam.setScroll(Math.round(at.x * ZOOM) / ZOOM, Math.round(at.y * ZOOM) / ZOOM);
    p.place(cam.scrollX - at.x, cam.scrollY - at.y);
  }

  holdForHit(fall: boolean, from: number) {
    this.camTarget.y = this.camAt.y + this.scene.cameras.main.height / 2; // `cutTo` releases the hold
    if (!REDUCED) {
      this.camAt.x -= from * 10;
      this.camAt.y += fall ? 10 : 0;
    }
  }

  kick(dy: number) {
    this.camAt.y += dy;
  }

  cutTo(x: number, y: number) {
    this.respawned = true;
    const cam = this.scene.cameras.main;
    this.camTarget.set(x, y - TILE);
    this.camAt.set(
      cam.clampX(this.camTarget.x - cam.width / 2),
      cam.clampY(this.camTarget.y - cam.height / 2),
    );
    this.lead = 0;
  }

  prepareWin() {
    // The camera eases toward the win's aim from the view it shows: its target ran past the level's end.
    this.camTarget.x = this.camAt.x + this.scene.cameras.main.width / 2;
  }
}
