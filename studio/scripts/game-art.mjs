// Builds the example game's art from the generated sources in game-art/ (prompts: prompts/game/).
// Needs ffmpeg and cwebp on PATH. Run from studio/: bun scripts/game-art.mjs
// Outputs atlas.webp, atlas.json, tiles.webp, sky.webp, mountains.webp, valley.webp, forest.webp,
// near.webp and foreground.webp.
// 1. pixelate.mjs snaps every source to its pixel grid, keying out the green screen; GRADE pulls a sheet
//    that shouts toward the night scene's muted colours
// 2. one shared 128-colour palette from all of them, and every image mapped to it (palette lock); a
//    graded sheet is graded again after that mapping, its saturated colours kept, and snapped back
//    onto the palette
// 3. sprites: sheet.mjs cuts each sheet into equal frames; all of them are packed into one atlas
//    (atlas.webp plus atlas.json, Phaser's JSON hash), frames named <sheet>-<n>
// 4. the tiles stay their own image (the tile frames), closed where they meet a neighbour (SEAMS)
// 5. background layers: each source (prompt: prompts/game/layers.txt, repainted finer with layer.txt)
//    scales to 1620x540, one period of the layer on the 960x540 grid, loses its green screen, goes onto a
//    few colours of its own (LAYERS) plus its warm lights' colours, and loses its 1-pixel speckle (clean),
//    so it is pixel art on the hero's grid with less detail than him; the valley below the mountains is drawn from them
// 6. the foreground occluder (prompt: prompts/game/foreground.txt): the same at 8 colours with a hard
//    edge, darkened, then cut to the 120 rows from just above its tallest tip, the only part the game shows
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { read, write } from "./workshop.mjs";

const SRC = fileURLToPath(new URL("../game-art/", import.meta.url));
const OUT = fileURLToPath(new URL("../../examples/present/assets/", import.meta.url));
const TMP = fileURLToPath(new URL("../game-art/.build/", import.meta.url));

// name, key colour, grid cell in source pixels, sheet.mjs options, whether the
// sheet starts with the wizard, drawn only to set the scale. The cell puts every sheet on one scale: the
// wizard's height in source pixels over 81 art pixels (image models paint coarser than asked, so most
// sheets are sampled finer or coarser than their painted blocks). The hero himself is drawn 94 tall, his
// relative height on the 320x180 grid: at 81 he read small on a phone.
const ART = [
  ["tiles", "00FF00", 8.1, ["--frame", "48x48", "--align", "top,top,top,top,top,top,top,top,top,center"]],
  ["hero", "00FF00", 4.7, []],
  ["bugs", "00FF00", 8.4, ["--cuts", "128,182"], true],
  ["props", "00FF00", 9.5, ["--trim"], true],
  ["big-props", "00FF00", 5.9, ["--trim"], true],
];
// frames kept from the start of a sheet: the generator drew confetti too small to survive the grid
const KEEP = { props: 9 };
// saturation kept, from 0 (grey) to 1 (as generated), and the night's blue cast added
const GRADE = { bugs: 0.55 };
// background layers: name, key colour, colour count (step 5)
const LAYERS = [
  ["sky", null, 24],
  ["mountains", "00FF00", 16],
  ["forest", "00FF00", 32],
  ["near", "00FF00", 24],
];
const FOREGROUND_COLORS = 8;
// the valley (step 5): its first row in the mountains texture (VALLEY_TOP in examples/present/levels/night-forest/backdrop.ts says the same) and its height
const VALLEY_TOP = 380;
const VALLEY_HEIGHT = 216;
// The tiles repeat side by side, but the cut leaves the middle tiles (snow 1, stone 4, plank 7) 47 wide
// with a ragged last column, which showed the sky at every join. A band of rows [first, last, source
// row, turn, repeats] reads the tile's columns from the left and repeats the column before each x in
// repeats, inside a joint, so 46 columns fill 48 (the stone's dark top row keeps its 47); a turn
// rotates the 46 columns, so the stone's courses stagger and no joint runs straight down a whole
// tile. [first, last, colour] is a mortar row (the stone gains 2 rows on its 46), null a transparent one.
// The middle plank drops its dark first and last columns, a dark line at every join, so 44 columns fill 48, and
// sits 4 rows lower, level with the end planks' boards and with the 4 px the game's plank body starts below the tile.
const SEAMS = {
  1: [
    [0, 31, 0, 0, [17, 27]],
    [32, 32, 0x0a0e19],
    [33, 46, 33, 23, [17, 27]],
    [47, 47, 47, 0, [17, 27]],
  ],
  4: [
    [0, 0, 0, 0, [47]],
    [1, 12, 1, 0, [15, 25]],
    [13, 13, 0x07080e],
    [14, 29, 13, 23, [22, 32]],
    [30, 30, 0x07080e],
    [31, 47, 29, 30, [15, 25]],
  ],
  7: [
    [0, 3, null],
    [4, 47, 0, 1, [10, 21, 32, 43]],
  ],
};
// the stone tiles' top row was mostly transparent: a gap there takes the pixel below it
const TOP = [3, 4, 5];
// the right edge tiles' first column becomes the joint's outline, from this row down
const LEFT = { 2: 16, 5: 1 };
// the end planks' dark outline column next to the middle plank takes the pixels of the column beside it
const PLANK_ENDS = { 6: 47, 8: 0 };

const ff = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
const encodeWebp = (name) =>
  execFileSync("cwebp", [
    "-quiet",
    "-lossless",
    "-exact",
    "-z",
    "9",
    `${TMP}${name}-final.png`,
    "-o",
    `${OUT}${name}.webp`,
  ]);
const bun = (...args) =>
  execFileSync("bun", args, { stdio: ["ignore", "pipe", "inherit"] })
    .toString()
    .trim();
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
const pixelate = (name, key, cell, extra) =>
  bun(
    "scripts/pixelate.mjs",
    `${SRC}${name}.webp`,
    `${TMP}${name}.png`,
    "--cell",
    String(cell),
    ...(key ? ["--key", key] : []),
    ...extra,
  );

// 1 and 2: snap at full colour, build the shared palette from every opaque pixel, snap again onto it
for (const [name, key, cell] of ART) pixelate(name, key, cell, ["--colors", "255"]);
// pal: after the palette pass, a saturated colour (HSV saturation from 0.35 up to full at 0.65)
// keeps its chroma so the sprite stays vivid on the night sky, and every pixel goes back to its
// nearest palette colour
const grade = (name, s, pal) => {
  const img = read(`${TMP}${name}.png`);
  const d = img.data;
  for (let p = 0; p < d.length; p += 4) {
    if (!d[p + 3]) continue;
    if (d[p] > 170 && d[p + 2] > 80 && d[p + 1] < 120 && d[p] - d[p + 1] > 100) continue; // the danger magenta stays
    const [mx, mn] = [Math.max(d[p], d[p + 1], d[p + 2]), Math.min(d[p], d[p + 1], d[p + 2])];
    const k = pal ? s + (1 - s) * Math.min(1, Math.max(0, ((mx ? (mx - mn) / mx : 0) - 0.35) / 0.3)) : s;
    const grey = 0.3 * d[p] + 0.59 * d[p + 1] + 0.11 * d[p + 2];
    const c = [
      grey + (d[p] - grey) * k,
      grey + (d[p + 1] - grey) * k,
      Math.min(255, grey + (d[p + 2] - grey) * k + 12),
    ];
    if (pal) {
      let best = pal[0];
      let bd = Infinity;
      for (const q of pal) {
        const e = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2;
        if (e < bd) [best, bd] = [q, e];
      }
      d.set(best, p);
    } else d.set(c, p);
  }
  write(`${TMP}${name}.png`, img);
};
// graded before the palette, so the palette holds the graded colours, and again after the palette
// pass below, which snaps the ungraded source anew
for (const [name, s] of Object.entries(GRADE)) grade(name, s);
const pixels = ART.flatMap(([name]) => {
  const { data } = read(`${TMP}${String(name)}.png`);
  const out = [];
  for (let p = 0; p < data.length; p += 4) if (data[p + 3]) out.push(data[p], data[p + 1], data[p + 2], 255);
  return out;
});
const side = Math.ceil(Math.sqrt(pixels.length / 4));
const all = new Uint8Array(side * side * 4);
all.set(pixels);
write(`${TMP}all.png`, { w: side, h: side, data: all });
ff(
  "-i",
  `${TMP}all.png`,
  "-vf",
  "palettegen=max_colors=128:reserve_transparent=1:stats_mode=full",
  `${TMP}palette.png`,
);
const palette = (() => {
  const { data } = read(`${TMP}palette.png`);
  const seen = new Map();
  for (let p = 0; p < data.length; p += 4)
    if (data[p + 3])
      seen.set(data[p] * 65536 + data[p + 1] * 256 + data[p + 2], [data[p], data[p + 1], data[p + 2]]);
  return [...seen.values()];
})();
for (const [name, key, cell, , wizard] of ART) {
  console.log(name, pixelate(name, key, cell, ["--palette", `${TMP}palette.png`]));
  if (GRADE[name]) grade(name, GRADE[name], palette);
  if (name === "tiles") {
    // The stone was painted blue: every blue-dominant pixel keeps 20 % of its colour, so the stone reads
    // neutral grey, the snow caps stay bright and the wood keeps its warmth.
    const img = read(`${TMP}tiles.png`);
    const d = img.data;
    for (let p = 0; p < d.length; p += 4) {
      if (d[p + 2] < d[p] + 20) continue;
      const grey = 0.3 * d[p] + 0.59 * d[p + 1] + 0.11 * d[p + 2];
      for (let k = 0; k < 3; k++) d[p + k] = grey + (d[p + k] - grey) * 0.2;
    }
    write(`${TMP}tiles.png`, img);
  }
  if (!wizard) continue;
  // The wizard can span both rows of a sheet, so he is cleared before cutting: everything reachable from
  // the leftmost opaque pixel in steps of up to 3 px, which keeps loose bits of his staff with him.
  const img = read(`${TMP}${String(name)}.png`);
  const opaque = (x, y) =>
    x >= 0 && y >= 0 && x < img.w && y < img.h && img.data[(y * img.w + x) * 4 + 3] > 0;
  let start = -1;
  for (let x = 0; x < img.w && start < 0; x++)
    for (let y = 0; y < img.h; y++) if (opaque(x, y)) start = y * img.w + x;
  const todo = [start];
  while (todo.length) {
    const i = todo.pop();
    const [x, y] = [i % img.w, Math.floor(i / img.w)];
    if (!opaque(x, y)) continue;
    img.data[i * 4 + 3] = 0;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) if (opaque(x + dx, y + dy)) todo.push(i + dy * img.w + dx);
  }
  write(`${TMP}${String(name)}.png`, img);
}

// 3 and 4
const frames = [];
for (const [name, , , opts] of ART) {
  const strip = `${TMP}${String(name)}-strip.png`;
  const said = bun("scripts/sheet.mjs", `${TMP}${String(name)}.png`, strip, ...Array.from(opts));
  console.log(name, said);
  if (name === "tiles") {
    const img = read(strip);
    const d = img.data;
    const at = (t, x, y) => (y * img.w + t * 48 + x) * 4;
    const rgba = (c) => (c === null ? [0, 0, 0, 0] : [c >> 16, (c >> 8) & 255, c & 255, 255]);
    for (const [t, bands] of Object.entries(SEAMS)) {
      const src = d.slice();
      for (const [first, last, from, turn, repeat] of bands)
        for (let y = first; y <= last; y++)
          for (let x = 0; x < 48; x++) {
            if (!repeat) {
              d.set(rgba(from), at(t, x, y));
              continue;
            }
            const sx = x - repeat.filter((r) => x >= r).length;
            const p = at(t, turn ? (sx + turn) % 46 : sx, from + y - first);
            d.set(src.subarray(p, p + 4), at(t, x, y));
          }
    }
    for (const t of TOP)
      for (let x = 0; x < 48; x++)
        if (!d[at(t, x, 0) + 3]) d.copyWithin(at(t, x, 0), at(t, x, 1), at(t, x, 1) + 4);
    for (const [t, first] of Object.entries(LEFT))
      for (let y = first; y < 48; y++) d.set(rgba(0x07080e), at(t, 0, y));
    for (const [t, x] of Object.entries(PLANK_ENDS))
      for (let y = 0; y < 48; y++)
        d.copyWithin(at(t, x, y), at(t, x ? x - 1 : 1, y), at(t, x ? x - 1 : 1, y) + 4);
    write(`${TMP}tiles-final.png`, img);
    encodeWebp("tiles");
    continue;
  }
  const img = read(strip);
  const [fw, fh] = said
    .match(/of (\d+)x(\d+)/)
    .slice(1)
    .map(Number);
  let sx = 0;
  said
    .split(": ")[1]
    .split(" ")
    .map((box) => box.split("x").map(Number))
    .forEach(([bw, bh], n) => {
      // --trim strips hold each box at its own width on the bottom edge, other strips equal frames
      const [w, h] = opts.includes("--trim") ? [bw, bh] : [fw, fh];
      if (n < (KEEP[name] ?? Infinity))
        frames.push({ name: `${String(name)}-${n}`, img, sx, sy: fh - h, w, h });
      sx += w;
    });
}

// shelf packing, tallest first, 1 px apart, into a 2048 px wide page
const W = 2048;
let x = 0;
let y = 0;
let shelf = 0;
for (const f of [...frames].sort((a, b) => b.h - a.h)) {
  if (x + f.w > W) [x, y, shelf] = [0, y + shelf + 1, 0];
  Object.assign(f, { x, y });
  x += f.w + 1;
  shelf = Math.max(shelf, f.h);
}
const H = y + shelf;
const atlas = { w: W, h: H, data: new Uint8Array(W * H * 4) };
const json = { frames: {}, meta: { image: "atlas.webp", size: { w: W, h: H }, scale: "1" } };
for (const f of frames) {
  for (let j = 0; j < f.h; j++) {
    const p = ((f.sy + j) * f.img.w + f.sx) * 4;
    atlas.data.set(f.img.data.subarray(p, p + f.w * 4), ((f.y + j) * W + f.x) * 4);
  }
  json.frames[f.name] = {
    frame: { x: f.x, y: f.y, w: f.w, h: f.h },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
    sourceSize: { w: f.w, h: f.h },
  };
}
write(`${TMP}atlas-final.png`, atlas);
encodeWebp("atlas");

// 5 and 6
// A cleaned pixel goes when its colour holds at most one of its 8 neighbours and one other colour (or
// transparency) holds at least 4 of them: it takes that colour. That removes the painting's 1-pixel
// speckle, so the layer is flat clusters with hard edges and less detail than the hero. A warm light
// pixel (keep) always stays. Bounds come from the image itself, so any size works.
const clean = (img, passes, keep = () => false) => {
  const { w, h } = img;
  const key = (d, p) => (d[p + 3] ? d[p] * 65536 + d[p + 1] * 256 + d[p + 2] : -1);
  for (let pass = 0; pass < passes; pass++) {
    const src = img.data.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        if (keep(src, p)) continue;
        const own = key(src, p);
        const count = new Map();
        let [best, most, mine] = [own, 0, 0];
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= w || y + dy >= h) continue;
            const q = p + (dy * w + dx) * 4;
            const k = key(src, q);
            if (k === own) mine++;
            const n = (count.get(k) ?? 0) + 1;
            count.set(k, n);
            if (n > most) [best, most] = [k, n];
          }
        if (mine > 1 || most < 4 || best === own) continue;
        img.data.set(best < 0 ? [0, 0, 0, 0] : [best >> 16, (best >> 8) & 255, best & 255, 255], p);
      }
  }
};
const isWarm = (d, p) => d[p + 3] && d[p] > 150 && d[p] > d[p + 1] + 40 && d[p] > d[p + 2] + 60;
// Warm lights (windows, lanterns) cover few pixels, so a palette by frequency drops their amber: the
// palette is the image's own colours plus up to 4 colours of its warm pixels alone. Every pixel goes to
// its nearest palette colour, without dithering, and is fully opaque or fully transparent.
const quantise = (name, colors) => {
  const img = read(`${TMP}${name}.png`);
  const { data } = img;
  const warm = [];
  for (let p = 0; p < data.length; p += 4) if (isWarm(data, p)) warm.push(...data.subarray(p, p + 4));
  write(`${TMP}${name}-warm.png`, {
    w: warm.length / 4 || 1,
    h: 1,
    data: new Uint8Array(warm.length ? warm : 4),
  });
  const pal = [];
  for (const [from, n] of [
    [name, colors],
    [`${name}-warm`, 4],
  ]) {
    if (n === 4 && !warm.length) continue;
    ff(
      "-i",
      `${TMP}${from}.png`,
      "-vf",
      `palettegen=max_colors=${n}:reserve_transparent=1:stats_mode=full`,
      `${TMP}${from}-palette.png`,
    );
    const { data: q } = read(`${TMP}${from}-palette.png`);
    for (let p = 0; p < q.length; p += 4) if (q[p + 3]) pal.push([q[p], q[p + 1], q[p + 2]]);
  }
  const near = new Map();
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] < 128) {
      data.set([0, 0, 0, 0], p);
      continue;
    }
    const k = data[p] * 65536 + data[p + 1] * 256 + data[p + 2];
    if (!near.has(k)) {
      let [best, bd] = [pal[0], Infinity];
      for (const c of pal) {
        const e = (c[0] - data[p]) ** 2 + (c[1] - data[p + 1]) ** 2 + (c[2] - data[p + 2]) ** 2;
        if (e < bd) [best, bd] = [c, e];
      }
      near.set(k, best);
    }
    data.set([...near.get(k), 255], p);
  }
  return img;
};
// The green screen spills into the painting and averaging down mixes it into the edges: a pixel still
// clearly green goes, and a bright pixel (the painted smoke) or an edge pixel (next to a transparent one)
// loses the green it has above its red and blue. Dark greens (the wreath, holly) stay.
const unGreen = ({ w, h, data: d }) => {
  for (let p = 0; p < d.length; p += 4)
    if (d[p + 1] > 140 && d[p + 1] > d[p] + 60 && d[p + 1] > d[p + 2] + 40) d[p + 3] = 0;
  const src = d.slice();
  const clear = (x, y) => x < 0 || y < 0 || x >= w || y >= h || !src[(y * w + x) * 4 + 3];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      if (d[p + 1] > 140 || clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1))
        d[p + 1] = Math.min(d[p + 1], Math.max(d[p], d[p + 2]));
    }
};
// Written as an indexed PNG, a quarter of the RGBA file size. The palette image holds exactly the image's
// colours (palettegen would shift some by one), the last entry transparent as palettegen writes it.
const save = (img, name, vf = "null") => {
  const colours = new Map();
  for (let p = 0; p < img.data.length; p += 4)
    if (img.data[p + 3]) colours.set(img.data[p] * 65536 + img.data[p + 1] * 256 + img.data[p + 2], p);
  const pal = new Uint8Array(256 * 4);
  [...colours.values()].forEach((p, i) => pal.set([...img.data.subarray(p, p + 3), 255], i * 4));
  for (let i = colours.size; i < 255; i++) pal.copyWithin(i * 4, 0, 4);
  write(`${TMP}${name}-pal.png`, { w: 16, h: 16, data: pal });
  write(`${TMP}${name}-out.png`, img);
  ff(
    "-i",
    `${TMP}${name}-out.png`,
    "-i",
    `${TMP}${name}-pal.png`,
    "-lavfi",
    `[0]${vf}[a];[a][1]paletteuse=dither=none:alpha_threshold=128`,
    `${TMP}${name}-final.png`,
  );
  encodeWebp(name);
};
// The valley under the mountains, which the game lays over every nearer layer when the camera climbs high above the
// pits: the mountains' own rows from VALLEY_TOP on, sinking first into two banks of mist (billows on a rolling row,
// each pixel moved toward MIST and back onto the mountains' palette) and then, in three ragged steps, into the night.
// Deterministic: the billows come from a fixed seed, so two builds write the same pixels.
const valley = (m) => {
  const [top, h, fogAt] = [VALLEY_TOP, VALLEY_HEIGHT, 452];
  const { w } = m;
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  const [NIGHT, MIST] = [
    [1, 4, 10],
    [19, 86, 154],
  ];
  // the mountains' cold colours: their warm window lights would come back in the haze as rust
  const pal = [];
  const seen = new Set();
  for (let p = 0; p < m.data.length; p += 4) {
    const k = m.data[p] * 65536 + m.data[p + 1] * 256 + m.data[p + 2];
    if (m.data[p + 3] && m.data[p] <= m.data[p + 2] && !seen.has(k)) {
      seen.add(k);
      pal.push([m.data[p], m.data[p + 1], m.data[p + 2]]);
    }
  }
  const nearest = (c) => {
    let [best, bd] = [pal[0], Infinity];
    for (const q of pal) {
      const e = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2;
      if (e < bd) [best, bd] = [q, e];
    }
    return best;
  };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const wave = (x, terms) =>
    terms.reduce((s, [k, a, ph]) => s + a * Math.sin((2 * Math.PI * k * x) / w + ph), 0);
  // an edge of billows on a slowly rolling row, wrapping at the period so the layer tiles
  const edge = (base, roll, size) => {
    const bumps = [];
    for (let x = 0; x < w - size;) {
      const r = size * (0.4 + 0.6 * rnd());
      bumps.push([x, r, rnd() * size * 0.3]);
      x += r * (0.8 + 0.9 * rnd());
    }
    const ph = [rnd() * 6.3, rnd() * 6.3];
    return Array.from({ length: w }, (_, x) => {
      const b =
        base +
        wave(x, [
          [2, roll, ph[0]],
          [5, roll / 2, ph[1]],
        ]);
      let y = b;
      for (const [cx, r, lift] of bumps) {
        const d = Math.min(Math.abs(x - cx), w - Math.abs(x - cx));
        if (d < r) y = Math.min(y, b - lift - Math.sqrt(r * r - d * d) * 0.5);
      }
      return Math.round(y);
    });
  };
  const fog = [edge(fogAt, 5, 36), edge(fogAt + 22, 4, 28)];
  const dark = [edge(fogAt + 26, 4, 24), edge(fogAt + 36, 3, 18), edge(fogAt + 44, 2, 12)];
  const img = { w, h, data: new Uint8Array(w * h * 4) };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const row = top + y;
      const p = (Math.min(row, m.h - 1) * w + x) * 4;
      let c = [m.data[p], m.data[p + 1], m.data[p + 2]];
      if (row >= fog[0][x]) c = mix(c, MIST, row - fog[0][x] < 2 ? 0.6 : 0.42);
      if (row >= fog[1][x]) c = mix(c, MIST, row - fog[1][x] < 2 ? 0.35 : 0.2);
      const level = dark.filter((d) => row >= d[x]).length;
      img.data.set(
        [...(level === 3 ? NIGHT : nearest(mix(c, NIGHT, [0, 0.45, 0.75][level]))), 255],
        (y * w + x) * 4,
      );
    }
  return img;
};
for (const [name, key, colors] of LAYERS) {
  ff(
    "-i",
    `${SRC}${name}.webp`,
    "-vf",
    `scale=1620:540:flags=area${key ? `,colorkey=0x${key}:0.35:0` : ""}`,
    `${TMP}${name}.png`,
  );
  const img = read(`${TMP}${name}.png`);
  if (key) unGreen(img);
  // The near layer's fence: snow on its posts and rails (rows 330 to 425, every channel above 120) turns
  // dark blue, so only the walkway's ground keeps bright snow tops.
  if (name === "near")
    for (let p = 330 * img.w * 4; p < Math.min(426, img.h) * img.w * 4; p += 4)
      if (img.data[p] > 120 && img.data[p + 1] > 120 && img.data[p + 2] > 120)
        img.data.set([0x36, 0x42, 0x60], p);
  write(`${TMP}${name}.png`, img);
  const out = quantise(name, colors);
  clean(out, 2, isWarm);
  save(out, name);
  if (name === "mountains") save(valley(out), "valley");
}
// The foreground occluder: one period at 1620x540 like the layers, keyed with a hard edge, darkened, few
// colours, then cut to the 120 rows from just above its tallest tip, the only part the game shows.
ff(
  "-i",
  `${SRC}foreground.webp`,
  "-vf",
  "scale=1620:540:flags=area,colorkey=0x00FF00:0.35:0,format=rgba,eq=brightness=-0.06:saturation=0.8",
  `${TMP}foreground.png`,
);
const fg = read(`${TMP}foreground.png`);
unGreen(fg);
write(`${TMP}foreground.png`, fg);
const fgq = quantise("foreground", FOREGROUND_COLORS);
clean(fgq, 2);
save(fgq, "foreground", "crop=1620:120:0:250");
writeFileSync(`${OUT}atlas.json`, `${JSON.stringify(json)}\n`);
// Formatted by the repo's own prettier, as the gate checks it: minified, it failed `prettier --check` after a rebuild.
execFileSync(fileURLToPath(new URL("../../node_modules/.bin/prettier", import.meta.url)), [
  "--write",
  `${OUT}atlas.json`,
]);
rmSync(TMP, { recursive: true, force: true });
console.log(`atlas ${W}x${H}, ${frames.length} frames`);
