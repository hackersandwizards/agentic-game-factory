import type Phaser from "phaser";
import { chip, HUD_ARROW, HUD_CHIP, HUD_DASH, hudSpeaker, SPEAKER, SPEAKER_OFF } from "./icons";
import { PALETTE } from "./palette";

// The repo URL as a QR code (https://github.com/hackersandwizards/agentic-game-factory), rendered once with
// qrcode-generator; the white border is the quiet zone scanners need.
const QR = [
  "ooooooowowwoowwoooowwwowwwooooooo",
  "owwwwwowwoowwwwwoooowoowwwowwwwwo",
  "owooowowwwowowwoowwowoowowowooowo",
  "owooowowwwwwowwwoooooowwowowooowo",
  "owooowowwowowwooowoowowwwwowooowo",
  "owwwwwowwwowowwooowwwwwowwowwwwwo",
  "ooooooowowowowowowowowowowooooooo",
  "wwwwwwwwowoowowoowwowwwoowwwwwwww",
  "oowoowowwooowowwoowoowwwwwowwwwwo",
  "wwwwwwwwwowwoowwowoowwwowwwoowoow",
  "ooooowowowoowowoowwwowooowooowwoo",
  "wwwwwwwwwooooowwoowoowwwoooowooww",
  "owwooooooowooowwwwwwowwowwoowwwoo",
  "oowwwwwwoowwwoooowowwowowowwwwwww",
  "oowwoooowooooowoowooooowwwoowwwww",
  "owwowwwowwoowwwoowwwwwwwwowwowowo",
  "ooowwooowoowwwooowwwowoooooooowoo",
  "wwoooowowwwooooowwoooowwwwooowwoo",
  "wowwwoowwwoowwwowowowwoowwwwowwwo",
  "owooowwoowowowooowwwwwwoowoowwooo",
  "owwwwwowowwwooowoowowwwooowwwwwww",
  "owwooowoooowwwoowwoowwoowwwooowow",
  "owwowooowwwwowoowowwwowowowowwwoo",
  "owoooowwwwowwwowwowwwwwwooowwwoww",
  "oowwwoowoowwwooowwooowwooooooowow",
  "wwwwwwwwowowowwoooowwwowowwwoooow",
  "ooooooowwoowwwoowwwoowooowowoowww",
  "owwwwwowwwowooooowwowwooowwwooooo",
  "owooowowowooowwowwwoowoooooooowww",
  "owooowowoooowwwowooowwowoowwwowoo",
  "owooowowwwowoooowwwowowooowwowooo",
  "owwwwwowoowowowwwwowowwwwowwwoooo",
  "ooooooowowoowowooowoowwooowwoowww",
].map((row) => `ww${row}ww`);
const QUIET = "w".repeat(QR[0].length);

// The world's effects, on the level's 960x540 grid: a far snowflake is one pixel.
const SNOW = ["w"];
const FLAKE = ["..i..", ".iwi.", "iwwwi", ".iwi.", "..i.."];
const DUST = ["..iiii..", ".iwwwwi.", "iwwwwwwi", "iwwwwwwi", ".iwwwwi.", "..iiii.."];
const SPARK = [
  "....X....",
  "....X....",
  "....x....",
  "...xXx...",
  "XXxXXXxXX",
  "...xXx...",
  "....x....",
  "....X....",
  "....X....",
];

// `Blood` uses these for spray, splats that stick to the ground, and drips down its face.
const DRIP = ["r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "rr", "RR", "rk"].map((row) =>
  row.padEnd(2, "."),
);
// A footprint in the snow, and the shooting star: a bright head with a tail that steps out.
const FOOTPRINT = ["fff", ".f."];
const STREAK = ["......iiiiwwwwwwwX", "...........iiiiwwX"];

// Confetti for the Konami code: five diamonds side by side, one frame each (bakeSprites adds the frames).
const CONFETTI = [".x..a..p..g..w.", "xxxaaapppgggwww", ".x..a..p..g..w."];

const SPRITES: Record<string, string[]> = {
  confetti: CONFETTI,
  qr: [QUIET, QUIET, ...QR, QUIET, QUIET],
  snow: SNOW,
  footprint: FOOTPRINT,
  streak: STREAK,
  speaker: SPEAKER,
  "speaker-off": SPEAKER_OFF,
  flake: FLAKE,
  dust: DUST,
  spark: SPARK,
  drip: DRIP,
  "chip-off": chip("i", "i"),
  "chip-on": chip("R", "w"),
  "hud-speaker": hudSpeaker(false),
  "hud-speaker-off": hudSpeaker(true),
  "hud-chip": HUD_CHIP,
  "arrow-up": HUD_ARROW,
  "arrow-left": HUD_ARROW[0].split("").map((_, x) => HUD_ARROW.map((row) => row[x]).join("")),
  "arrow-right": HUD_ARROW[0].split("").map((_, x) =>
    HUD_ARROW.map((row) => row[x])
      .reverse()
      .join(""),
  ),
  dash: HUD_DASH,
};

export function bakeSprites(scene: Phaser.Scene) {
  for (const [key, rows] of Object.entries(SPRITES)) {
    if (scene.textures.exists(key)) continue;
    const texture = scene.textures.createCanvas(key, Math.max(...rows.map((r) => r.length)), rows.length)!;
    const ctx = texture.getContext();
    rows.forEach((row, y) =>
      Array.from(row).forEach((char, x) => {
        if (!PALETTE[char]) return;
        ctx.fillStyle = PALETTE[char];
        ctx.fillRect(x, y, 1, 1);
      }),
    );
    if (key === "confetti") for (let i = 0; i < 5; i++) texture.add(i, 0, i * 3, 0, 3, 3);
    texture.refresh();
  }
}
