// Cleans up AI "pixel art" into real pixel art: the generator paints soft blocks of a few screen
// pixels each, never exactly on a grid. Needs ffmpeg on PATH.
//   bun scripts/pixelate.mjs <in.png> <out.png> [--colors 32] [--key 00FF00] [--cell 6.5] [--palette p.png]
// 1. grid detect: the block size and offset, from where colour edges repeat (or --cell)
// 2. nearest downscale: one art pixel per block, the block's centre pixel
// 3. palette quantise: at most --colors colours, no dithering
// 4. chroma binarise: with --key, pixels near that background colour turn fully transparent and
//    every other pixel fully opaque, so a sprite cut from a green screen has a hard 1 px edge, and
//    a key-tinted rim pixel goes too
// With --palette <png> (a palette image, as ffmpeg's palettegen writes), step 3 maps to that palette
// instead, so every sheet of a game shares one palette.
import { execFileSync } from "node:child_process";
import { read } from "./workshop.mjs";

const [input, output, ...opts] = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = opts.indexOf(`--${name}`);
  return i >= 0 ? opts[i + 1] : fallback;
};
if (!output) {
  console.error(
    "usage: pixelate.mjs <in.png> <out.png> [--colors 32] [--key 00FF00] [--cell 6.5] [--palette p.png]",
  );
  process.exit(1);
}
const img = read(input);
const { w, h, data } = img;

// edge strength between neighbours, summed along one axis
const edges = (horizontal) => {
  const n = horizontal ? w : h;
  const e = new Float64Array(n);
  for (let y = horizontal ? 0 : 1; y < h; y++)
    for (let x = horizontal ? 1 : 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const q = horizontal ? p - 4 : p - w * 4;
      let d = 0;
      for (let c = 0; c < 3; c++) d += Math.abs(data[p + c] - data[q + c]);
      e[horizontal ? x : y] += d;
    }
  return e;
};

// one Fourier term per candidate block size: how much edge energy lines up at that period, and at
// which phase. Square blocks, so both axes vote on one size. Divisors of the true size score as
// high, so the largest size within 90 % of the best wins.
const term = (e, s) => {
  let re = 0;
  let im = 0;
  let total = 0;
  for (let x = 0; x < e.length; x++) {
    const a = (2 * Math.PI * x) / s;
    re += e[x] * Math.cos(a);
    im += e[x] * Math.sin(a);
    total += e[x];
  }
  const offset = ((((Math.atan2(im, re) / (2 * Math.PI)) * s) % s) + s) % s;
  return { score: Math.hypot(re, im) / (total || 1), offset };
};
const ex = edges(true);
const ey = edges(false);
let s = Number(opt("cell", 0));
if (!s) {
  const scores = [];
  for (let c = 2; c <= 40; c += 0.05) scores.push({ c, score: term(ex, c).score + term(ey, c).score });
  const best = Math.max(...scores.map((k) => k.score));
  if (best < 0.1) {
    console.error(`no pixel grid found (score ${best.toFixed(3)}): pass --cell <block size in px>`);
    process.exit(1);
  }
  s = scores.filter((k) => k.score >= best * 0.9).at(-1).c;
}
const gx = { s, offset: term(ex, s).offset };
const gy = { s, offset: term(ey, s).offset };
const cols = Math.floor((w - gx.offset) / gx.s);
const rows = Math.floor((h - gy.offset) / gy.s);
console.log(
  `cell ${s.toFixed(2)} px, offset ${gx.offset.toFixed(1)},${gy.offset.toFixed(1)} -> ${cols}x${rows}`,
);

const key = opt("key");
const [kr, kg, kb] = key ? [0, 2, 4].map((i) => parseInt(key.slice(i, i + 2), 16)) : [];
const small = new Uint8Array(cols * rows * 4);
for (let j = 0; j < rows; j++)
  for (let i = 0; i < cols; i++) {
    const x = Math.min(w - 1, Math.floor(gx.offset + (i + 0.5) * gx.s));
    const y = Math.min(h - 1, Math.floor(gy.offset + (j + 0.5) * gy.s));
    const p = (y * w + x) * 4;
    const o = (j * cols + i) * 4;
    small.set(data.subarray(p, p + 4), o);
    const near = key && Math.hypot(data[p] - kr, data[p + 1] - kg, data[p + 2] - kb) < 120;
    small[o + 3] = near || data[p + 3] < 128 ? 0 : 255;
  }

// The blend between a sprite and its screen survives as a rim of key-tinted pixels: drop an edge
// pixel whose key channels outweigh the others (green over red and blue for 00FF00).
if (key) {
  const hi = [kr, kg, kb].map((c) => c >= 128);
  const tint = (o) => {
    const c = [0, 1, 2].map((k) => small[o + k]);
    return Math.min(...c.filter((_, k) => hi[k])) - Math.max(...c.filter((_, k) => !hi[k]));
  };
  const clear = (i, j) => i < 0 || j < 0 || i >= cols || j >= rows || !small[(j * cols + i) * 4 + 3];
  const rim = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const o = (j * cols + i) * 4;
      const edge = clear(i - 1, j) || clear(i + 1, j) || clear(i, j - 1) || clear(i, j + 1);
      if (small[o + 3] && edge && tint(o) > 25) rim.push(o);
    }
  for (const o of rim) small[o + 3] = 0;
}

const colors = opt("colors", "32");
const palette = opt("palette");
const raw = ["-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${cols}x${rows}`, "-i", "-"];
execFileSync(
  "ffmpeg",
  [
    "-v",
    "error",
    "-y",
    ...raw,
    ...(palette
      ? ["-i", palette, "-lavfi", "[0][1]paletteuse=dither=none:alpha_threshold=128"]
      : [
          "-vf",
          `split[a][b];[a]palettegen=max_colors=${colors}:reserve_transparent=1:stats_mode=full[p];[b][p]paletteuse=dither=none:alpha_threshold=128`,
        ]),
    output,
  ],
  { input: Buffer.from(small) },
);
