import "@fontsource/press-start-2p/latin-400.css";
import Phaser from "phaser";
import { HW, SCREEN_H, SCREEN_W } from "../design/tokens";
import { FEEL } from "../entities/wizard";
import { LevelScene } from "../levels/level-scene";
import { NIGHT_FOREST } from "../levels/night-forest";
import { TitleScene } from "./title";

// Bring the present home: step out of the h&w workshop, collect crystals, stomp bugs, reach the laptop.
// The module map is in docs/example-architecture.md.

await document.fonts.load('8px "Press Start 2P"');

// A 1920x1080 canvas scaled to fit any screen. The art is pixel art drawn at 2x (6x on the title), so
// smoothPixelArt keeps its pixels square with clean edges at every size and while sprites move by
// less than an art pixel.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: SCREEN_W,
  height: SCREEN_H,
  parent: "screen", // not "game": an element id becomes a window global and would shadow window.game while booting
  backgroundColor: HW.night,
  render: { smoothPixelArt: true, roundPixels: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 }, // two thumbs on the touch buttons, plus one spare
  physics: {
    default: "arcade",
    // Arcade separates overlaps up to overlapBias px per step (default 4): doubled with the world's scale.
    arcade: { gravity: { x: 0, y: FEEL.gravity }, overlapBias: 8 },
  },
  audio: { noAudio: true },
  scene: [TitleScene, new LevelScene(NIGHT_FOREST)],
});
// On window so tests can read game state, and the movement feel numbers (tests/smoke.spec.ts).
Object.assign(window, { game, FEEL });
