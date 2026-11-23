// Turns a cleaned sheet (pixelate.mjs with --key: objects on transparency) into a strip of equal
// frames: game-art.mjs packs them into the game's atlas. Needs ffmpeg on PATH.
//   bun scripts/sheet.mjs <in.png> <out.png> [--frame 24x24 | --trim] [--align bottom|top|center,...]
//     [--cuts 39,77]
// Objects are found in reading order: rows split where a whole pixel row is empty, objects within
// a row where a column is empty or at a column --cuts names (objects the generator drew touching).
// Each object is trimmed to its box and placed centred in its frame, on the frame's bottom edge
// (feet on one baseline), its top edge or centred both ways; a comma list aligns frame by frame,
// its last entry repeating. The frame is the largest object's size unless --frame names one; a
// larger object is cropped. --trim keeps every object at its own box instead, side by side on one
// bottom edge (single props, whose origin then sits on their own edges). Prints the frame count,
// the frame size and every object's box.
import { read, write } from "./workshop.mjs";

const [input, output, ...opts] = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = opts.indexOf(`--${name}`);
  return i >= 0 ? opts[i + 1] : fallback;
};
if (!output) {
  console.error(
    "usage: sheet.mjs <in.png> <out.png> [--frame 24x24 | --trim] [--align bottom|top|center,...] [--cuts 39,77]",
  );
  process.exit(1);
}
const img = read(input);
const cuts = new Set(opt("cuts", "").split(",").filter(Boolean).map(Number));
const opaque = (x, y) => !cuts.has(x) && img.data[(y * img.w + x) * 4 + 3] > 0;

// runs of indices where `filled(i)` holds, split by gaps of at least `gap` empty indices
const runs = (n, filled, gap) => {
  const out = [];
  let start = -1;
  let empty = 0;
  for (let i = 0; i <= n; i++) {
    if (i < n && filled(i)) {
      if (start < 0) start = i;
      empty = 0;
    } else if (start >= 0 && (++empty >= gap || i === n)) {
      out.push([start, i - empty]);
      start = -1;
    }
  }
  return out;
};
const rowFilled = (y, x0 = 0, x1 = img.w - 1) => {
  for (let x = x0; x <= x1; x++) if (opaque(x, y)) return true;
  return false;
};
const colFilled = (x, y0, y1) => {
  for (let y = y0; y <= y1; y++) if (opaque(x, y)) return true;
  return false;
};

const boxes = [];
for (const [y0, y1] of runs(img.h, (y) => rowFilled(y), 1))
  for (const [x0, x1] of runs(img.w, (x) => colFilled(x, y0, y1), 1)) {
    const rows = runs(y1 - y0 + 1, (i) => rowFilled(y0 + i, x0, x1), Infinity)[0];
    boxes.push({ x: x0, y: y0 + rows[0], w: x1 - x0 + 1, h: rows[1] - rows[0] + 1 });
  }

const trim = opts.includes("--trim");
const [fw, fh] = opt("frame", "")
  ? opt("frame").split("x").map(Number)
  : [Math.max(...boxes.map((b) => b.w)), Math.max(...boxes.map((b) => b.h))];
const aligns = opt("align", "bottom").split(",");
const left = boxes.map((_, n) => (trim ? boxes.slice(0, n).reduce((x, b) => x + b.w, 0) : n * fw));
const width = trim ? boxes.reduce((x, b) => x + b.w, 0) : fw * boxes.length;
const out = { w: width, h: fh, data: new Uint8Array(width * fh * 4) };
boxes.forEach((b, n) => {
  const w = trim ? b.w : fw;
  const dx = left[n] + Math.floor((w - b.w) / 2);
  const align = trim ? "bottom" : aligns[Math.min(n, aligns.length - 1)];
  const dy = align === "top" ? 0 : align === "center" ? Math.floor((fh - b.h) / 2) : fh - b.h;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const tx = dx + x;
      const ty = dy + y;
      if (tx < left[n] || tx >= left[n] + w || ty < 0 || ty >= fh) continue;
      const p = ((b.y + y) * img.w + b.x + x) * 4;
      out.data.set(img.data.subarray(p, p + 4), (ty * out.w + tx) * 4);
    }
});
write(output, out);
console.log(`${boxes.length} frames of ${fw}x${fh}: ${boxes.map((b) => `${b.w}x${b.h}`).join(" ")}`);
