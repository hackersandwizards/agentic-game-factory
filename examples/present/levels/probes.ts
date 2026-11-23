import type Phaser from "phaser";
import type { BugPatrol } from "../entities/bugs";
import type { NightLight } from "../systems/light";
import type { Hint } from "../ui/hint";
import type { Hud } from "../ui/hud";
import type { Popups } from "../ui/popups";
import type { Touch } from "../ui/touch";
import type { Layout } from "./layout";
import type { LevelBackdrop } from "./level";
import type { LevelRun } from "./reactions";

// The night forest's backdrop parts that the tests read: another level's backdrop may have none of them.
type Scenery = Partial<Record<"layers" | "fogs" | "fade" | "foreground", unknown>>;

type Probed = Phaser.Scene & {
  run: LevelRun;
  layout: Layout;
  backdrop: LevelBackdrop & Scenery;
  light: NightLight;
  bugPatrol: BugPatrol;
  hudView: Hud;
  hint: Hint;
  popups: Popups;
  controls: Touch;
};

/**
 * Puts the names the tests read on the level scene (docs/example-architecture.md, "What stays as it is"), each
 * read from, and where a test sets it written to, the part that owns it.
 */
export function exposeState(scene: Probed) {
  const assign =
    <T, K extends keyof T>(part: () => T, key: K) =>
    (value: T[K]) => {
      part()[key] = value;
    };
  const run = () => scene.run;
  const patrol = () => scene.bugPatrol;
  const hint = () => scene.hint;
  Object.defineProperties(scene, {
    bugs: { get: () => scene.bugPatrol.bugs },
    walks: { get: () => scene.bugPatrol.walks },
    corpses: { get: () => scene.bugPatrol.corpses },
    trees: { get: () => scene.layout.checkpoints.trees },
    laptop: { get: () => scene.layout.goal.sight },
    present: { get: () => scene.layout.goal.present },
    layers: { get: () => scene.backdrop.layers },
    fogs: { get: () => scene.backdrop.fogs },
    fade: { get: () => scene.backdrop.fade },
    foreground: { get: () => scene.backdrop.foreground },
    mask: { get: () => scene.light.mask },
    hud: { get: () => scene.hudView.hud },
    hudBacking: { get: () => scene.hudView.hudBacking },
    // The world's y at the canvas HUD's bottom edge: the view's top where the HUD is gone or HTML (upright).
    hudFloor: { get: () => scene.cameras.main.worldView.y + scene.hudView.height },
    hearts: { get: () => scene.hudView.hearts },
    timer: { get: () => scene.hudView.timer },
    help: { get: () => scene.hint.help },
    helpMoving: { get: () => scene.hint.helpMoving, set: assign(hint, "helpMoving") },
    lines: { get: () => scene.popups.lines },
    padRoom: { get: () => scene.controls.padRoom },
    smoothBugs: { get: () => scene.bugPatrol.smoothBugs, set: assign(patrol, "smoothBugs") },
    lives: { get: () => scene.run.lives, set: assign(run, "lives") },
    won: { get: () => scene.run.won },
    gameOver: { get: () => scene.run.gameOver },
    crystals: { get: () => scene.run.crystals, set: assign(run, "crystals") },
    totalCrystals: { get: () => scene.run.totalCrystals },
    secret: { get: () => scene.run.secret, set: assign(run, "secret") },
    score: { get: () => scene.run.score, set: assign(run, "score") },
    chain: { get: () => scene.run.chain },
    longestChain: { get: () => scene.run.longestChain, set: assign(run, "longestChain") },
    kills: { get: () => scene.run.kills, set: assign(run, "kills") },
    hits: { get: () => scene.run.hits, set: assign(run, "hits") },
    invulnerableUntil: {
      get: () => scene.run.invulnerableUntil,
      set: assign(run, "invulnerableUntil"),
    },
    startedAt: { get: () => scene.run.startedAt, set: assign(run, "startedAt") },
  });
}
