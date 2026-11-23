import Phaser from "phaser";
import { colors } from "../../../brand.json";

// The canvas is 1920x1080 and scales to fit the screen. The level's art sits on a 960x540 grid, drawn
// at 2 screen pixels per art pixel: the level world, the HUD and the touch buttons use that grid. Text
// and the code icons keep the 320x180 layout they were made for, 3 art pixels per font pixel. The title
// keeps the video's 320x180 grid at 6 screen pixels per pixel. Why 960: docs/res-matrix.md.
export const SCREEN_W = 1920;
export const SCREEN_H = 1080;
export const WIDTH = 960;
export const HEIGHT = 540;
export const ZOOM = SCREEN_W / WIDTH;
// The zoomed camera's view origin for objects with scroll factor 0.
export const PAD_X = (WIDTH * ZOOM - WIDTH) / 2;
export const PAD_Y = (HEIGHT * ZOOM - HEIGHT) / 2;
// Level text and panels keep their 320x180 layout, drawn this many times larger.
export const TEXT_SCALE = 3;
// Art pixels per pixel of the 320x180 grid the level's movement and effects were first tuned on.
export const GRID_SCALE = 3;
// The game's own pixel palette by name, as CSS colours; TINT holds the same colours as the numbers Phaser tints with.
export const COLOR = {
  outline: "#05080c",
  snow: "#e8f1f2",
  snowShade: "#9fb8d0",
  crystal: "#2dd4bf",
  crystalLight: "#b8fff2",
  red: "#ef4444",
  amber: "#f59e0b",
  gold: "#fde68a", // light amber: what counts as gold, and every flash
  purple: "#a855f7",
  secret: "#9333ea", // the secret crystal's light
  green: "#4ade80",
  footprint: "#1b2a3c",
  // 18+ mode's blood: deep red, its fresh highlight and dark clots, apart from the danger magenta
  blood: "#b0101c",
  bloodLight: "#e8283a",
  bloodDark: "#5a0810",
  danger: "#ff2e88", // the bugs' magenta
  glitch: "#00e5ff", // 18+ mode's cyan, the colour split of a glitching screen
  dim: "#5a6478", // spent or missed: the staff after a dash, an award not earned
  white: "#ffffff",
};
export const TINT = Object.fromEntries(
  Object.entries(COLOR).map(([name, hex]) => [name, parseInt(hex.slice(1), 16)]),
) as Record<keyof typeof COLOR, number>;
export const TEXT: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Press Start 2P"',
  fontSize: "8px",
  color: COLOR.snow,
};
// h&w's colours, from the one copy of the brand palette in brand.json: the night under every scene, the
// wordmark's teal and ampersand grey.
export const HW = colors;
export const NIGHT = Phaser.Display.Color.HexStringToColor(HW.night).color;
export const NIGHT_RGB = Phaser.Display.Color.IntegerToRGB(NIGHT);
export const TEAL = Phaser.Display.Color.HexStringToColor(HW.teal).color;
export const PORTRAIT = matchMedia("(orientation: portrait)");
// The player's system asks for less motion: no zoom through the door, no blinking or pulsing loops, no shake.
export const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
