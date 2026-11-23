// The title's mute button: a speaker with sound waves, or with a red cross when muted.
export const SPEAKER = [
  "...w......",
  "..ww...i..",
  "wwww.i..i.",
  "wwww.i..i.",
  "wwww.i..i.",
  "wwww.i..i.",
  "..ww...i..",
  "...w......",
];
export const SPEAKER_OFF = [
  "...w......",
  "..ww......",
  "wwww.e..e.",
  "wwww..ee..",
  "wwww..ee..",
  "wwww.e..e.",
  "..ww......",
  "...w......",
];
// The 18+ switch: "18+" in the boards' 3x5 font on a dark chip, its frame red when on.
const CHIP_GLYPHS = [".o./oo./.o./.o./ooo", "ooo/o.o/ooo/o.o/ooo", ".../.o./ooo/.o./..."];
export const chip = (frame: string, ink: string) =>
  Array.from({ length: 9 }, (_, y) =>
    Array.from({ length: 15 }, (_, x) => {
      if (x === 0 || x === 14 || y === 0 || y === 8) return frame;
      const [gx, gy] = [x - 2, y - 2];
      const glyph = CHIP_GLYPHS[Math.floor(gx / 4)];
      return gy >= 0 && gy < 5 && gx >= 0 && gx % 4 < 3 && glyph?.split("/")[gy][gx % 4] === "o" ? ink : "o";
    }).join(""),
  );
// The level's HUD and touch icons on its 960x540 grid, one pixel the size of the crystal's and the heart's: the
// shapes above, the title's (its 320x180 grid draws them 6 screen pixels a pixel), redrawn from their geometry.
// grid() fills each pixel with the character ink(x, y) returns for its centre.
const grid = (w: number, h: number, ink: (x: number, y: number) => string) =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ink(x + 0.5, y + 0.5)).join(""));
// The speaker: a box and a cone, two arcs of sound or a red cross.
export const hudSpeaker = (off: boolean) =>
  grid(30, 24, (x, y) => {
    const dy = Math.abs(y - 12);
    if ((x > 2 && x < 9 && dy < 4) || (x >= 9 && x < 15 && dy < x - 5)) return "w";
    const [cx, cy] = [x - 22, y - 12];
    if (off) return Math.abs(Math.abs(cx) - Math.abs(cy)) < 1.5 && Math.abs(cx) < 5 ? "e" : ".";
    return soundWaves(x - 14, cy);
  });

function soundWaves(x: number, y: number) {
  const r = Math.hypot(x, y);
  return Math.abs(y) < x * 1.2 && ((r > 5 && r < 7.5) || (r > 10 && r < 12.5)) ? "i" : ".";
}
// "18+" with strokes 2 pixels wide on a dark chip in a red frame with cut corners.
const CHIP_FONT = [
  "...ww../..www../.wwww../...ww../...ww../...ww../...ww../...ww../...ww../.wwwwww/.wwwwww",
  ".wwwww./wwwwwww/ww...ww/ww...ww/.wwwww./wwwwwww/ww...ww/ww...ww/ww...ww/wwwwwww/.wwwww.",
  "....../....../....../..ww../..ww../wwwwww/wwwwww/..ww../..ww../....../......",
].map((glyph) => glyph.split("/"));
export const HUD_CHIP = grid(45, 27, (x, y) => {
  const [px, py] = [Math.floor(x), Math.floor(y)];
  const edge = Math.min(px, 44 - px) + Math.min(py, 26 - py);
  if (edge === 0) return ".";
  if (px < 2 || px > 42 || py < 2 || py > 24) return "R";
  let left = 11;
  for (const glyph of CHIP_FONT) {
    const row = glyph[py - 8];
    if (row && px >= left && px < left + row.length) return row[px - left] === "w" ? "w" : "o";
    left += glyph[0].length + 2;
  }
  return "o";
});
// The touch jump button's arrow (the run buttons' turned) and the dash's four-pointed star.
export const HUD_ARROW = grid(33, 27, (x, y) =>
  (y < 18 ? Math.abs(x - 16.5) < y * 0.92 : Math.abs(x - 16.5) < 7.5) ? "w" : ".",
);
export const HUD_DASH = grid(27, 27, (x, y) => {
  const d = (Math.abs(x - 13.5) ** 0.6 + Math.abs(y - 13.5) ** 0.6) ** (1 / 0.6);
  return d < 6 ? "X" : d < 13 ? "x" : ".";
});
