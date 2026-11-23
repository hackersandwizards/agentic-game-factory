// The workshop picture as a frozen base plus per-customer slot fills (greeting/slots.json).
// Needs ffmpeg on PATH.
//   bun scripts/workshop.mjs crop <slot> <out.png>
//     the slot's box of the base at 4x, the reference for an image-generation edit
//   bun scripts/workshop.mjs cut <slot> <edited.png> <out.png> [--from x,y,w,h] [--only x,y,w,h] [--shadow]
//     a slot fill: the edited crop (or a full-size picture) scaled back to the box, reduced to
//     64 colours, kept only where it differs from the base (holes filled), edges softened by
//     one pixel, with a warning where the change runs into the box's edge;
//     --from names the box the edit was made on when it is not the slot's, --only keeps the change
//     inside that image box and drops whatever else the edit moved, --shadow adds a
//     soft contact shadow under the object
//   bun scripts/workshop.mjs compose <customer>
//     <customer>/workshop.png in the customers folder, its magenta twin and its -960 sibling
//     from the base and the fills named in the customer's `slots`, and the customer's hubLayout
//     from the slot table. The customers folder is $GREETING_CUSTOMERS, else greeting/customers.
//   bun scripts/workshop.mjs snap <in.png> <out.png>
//     a picture on the film's art grid: area-sampled to 960x540 and quantised to 256 colours,
//     no dither; the greeting shows every workshop picture this way (the -960 siblings), and
//     workshop-hw-960.png is the game kit's title picture
//   bun scripts/workshop.mjs layout
//     the hubLayout of the bare base, the composition's default
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const VIDEO = fileURLToPath(new URL("../greeting/", import.meta.url));
const CUSTOMERS = resolve(process.env.GREETING_CUSTOMERS || `${VIDEO}customers`);
const TABLE = JSON.parse(readFileSync(`${VIDEO}slots.json`, "utf8"));

const size = (file) =>
  execFileSync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=p=0",
    file,
  ])
    .toString()
    .trim()
    .split(",")
    .map(Number);

// RGBA pixels of a file after an optional ffmpeg filter chain producing w x h
// fmt forces the input format, so a customer's file is read as that and nothing else
export const read = (file, vf, w, h, fmt) => {
  if (!w) [w, h] = size(file);
  const args = ["-v", "error", ...(fmt ? ["-f", fmt] : []), "-i", file];
  if (vf) args.push("-vf", vf);
  args.push("-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-");
  const data = execFileSync("ffmpeg", args, { maxBuffer: w * h * 4 + 1024 });
  return { w, h, data: new Uint8Array(data) };
};

// the pixels go through a file: from a pipe, ffmpeg reads the frame in chunks and warns about each
export const write = (file, img) => {
  const raw = `${file}.rgba`;
  writeFileSync(raw, img.data);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgba",
    "-s",
    `${img.w}x${img.h}`,
    "-i",
    raw,
    file,
  ]);
  rmSync(raw);
};

const snap = (src, dst) =>
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    src,
    "-vf",
    "scale=960:540:flags=area,split[a][b];[a]palettegen=max_colors=256:reserve_transparent=0:stats_mode=full[p];[b][p]paletteuse=dither=none",
    dst,
  ]);

const slotBox = (id) => {
  const box = TABLE.slots[id]?.box;
  if (!box) throw new Error(`slot ${id} has no box to paint`);
  return box;
};

const crop = (id, out) => {
  const [x, y, w, h] = slotBox(id);
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    VIDEO + TABLE.base,
    "-vf",
    `crop=${w}:${h}:${x}:${y},scale=iw*4:ih*4:flags=neighbor`,
    out,
  ]);
};

// the fill for box [x, y, w, h] from an edited crop of box `from`, or from a full-size picture
const cut = (box, edited, from, shadow, only) => {
  const [bx, by, bw, bh] = box;
  const [fx, fy, fw, fh] = from ?? [bx, by, bw, bh];
  const [ew, eh] = size(edited);
  const [iw, ih] = size(VIDEO + TABLE.base);
  const pal = "split[a][b];[a]palettegen=max_colors=64:reserve_transparent=0[p];[b][p]paletteuse=dither=none";
  const src =
    ew === iw && eh === ih
      ? read(edited, `crop=${fw}:${fh}:${fx}:${fy},${pal}`, fw, fh)
      : read(edited, `scale=${fw}:${fh}:flags=area,${pal}`, fw, fh);
  const base = read(VIDEO + TABLE.base, `crop=${fw}:${fh}:${fx}:${fy}`, fw, fh);
  // differs from the base: any channel by more than 40, on a 3x3 mean
  const N = fw * fh;
  const raw = new Uint8Array(N);
  for (let y = 0; y < fh; y++)
    for (let x = 0; x < fw; x++) {
      let d = 0;
      for (let c = 0; c < 3; c++) {
        let s = 0;
        let n = 0;
        for (let j = -1; j <= 1; j++)
          for (let i = -1; i <= 1; i++) {
            const xx = x + i;
            const yy = y + j;
            if (xx < 0 || yy < 0 || xx >= fw || yy >= fh) continue;
            const p = (yy * fw + xx) * 4 + c;
            s += src.data[p] - base.data[p];
            n++;
          }
        d = Math.max(d, Math.abs(s / n));
      }
      raw[y * fw + x] = d > 40 ? 1 : 0;
    }
  const morph = (m, r, grow) => {
    const o = new Uint8Array(N);
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++) {
        let hit = !grow;
        for (let j = -r; j <= r && hit !== grow; j++)
          for (let i = -r; i <= r; i++) {
            const xx = Math.min(fw - 1, Math.max(0, x + i));
            const yy = Math.min(fh - 1, Math.max(0, y + j));
            if (Boolean(m[yy * fw + xx]) === grow) {
              hit = grow;
              break;
            }
          }
        o[y * fw + x] = hit ? 1 : 0;
      }
    return o;
  };
  const m = morph(morph(raw, 3, true), 2, false);
  // --only: the change you asked for sits in this image box; whatever the edit moved elsewhere stays
  if (only) {
    const [ox, oy, ow, oh] = only;
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++) {
        const X = x + fx;
        const Y = y + fy;
        if (X < ox || Y < oy || X >= ox + ow || Y >= oy + oh) m[y * fw + x] = 0;
      }
  }
  // drop specks: components under 0.5 % of the box
  const seen = new Uint8Array(N);
  for (let p0 = 0; p0 < N; p0++) {
    if (!m[p0] || seen[p0]) continue;
    const comp = [p0];
    seen[p0] = 1;
    for (let k = 0; k < comp.length; k++) {
      const p = comp[k];
      const x = p % fw;
      for (const q of [p - 1, p + 1, p - fw, p + fw]) {
        if (q < 0 || q >= N || seen[q] || !m[q]) continue;
        if (Math.abs((q % fw) - x) > 1) continue;
        seen[q] = 1;
        comp.push(q);
      }
    }
    if (comp.length < N * 0.005) for (const p of comp) m[p] = 0;
  }
  // fill holes: a pixel the box border cannot reach through unchanged pixels is the object's
  // own, even where it matches the base (floor lines through a sack)
  const out0 = new Uint8Array(N);
  const stack = [];
  for (let p = 0; p < N; p++) {
    const x = p % fw;
    const y = (p - x) / fw;
    if (!m[p] && (x === 0 || y === 0 || x === fw - 1 || y === fh - 1)) {
      out0[p] = 1;
      stack.push(p);
    }
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % fw;
    for (const q of [p - 1, p + 1, p - fw, p + fw]) {
      if (q < 0 || q >= N || out0[q] || m[q] || Math.abs((q % fw) - x) > 1) continue;
      out0[q] = 1;
      stack.push(q);
    }
  }
  for (let p = 0; p < N; p++) if (!out0[p]) m[p] = 1;
  if (!m.some(Boolean)) throw new Error("cut: the edit changes nothing here (check the box and --only)");
  // a change running into the box's edge ends in a straight seam, unless that edge is the frame's
  const edges = {
    left: fx > 0 && [...Array(fh).keys()].some((y) => m[y * fw]),
    right: fx + fw < iw && [...Array(fh).keys()].some((y) => m[y * fw + fw - 1]),
    top: fy > 0 && [...Array(fw).keys()].some((x) => m[x]),
    bottom: fy + fh < ih && [...Array(fw).keys()].some((x) => m[(fh - 1) * fw + x]),
  };
  // and so does one running into the --only box's edge
  if (only) {
    const [ox, oy, ow, oh] = only;
    const on = (X, Y) => X >= fx && Y >= fy && X < fx + fw && Y < fy + fh && m[(Y - fy) * fw + X - fx];
    const any = (n, f) => [...Array(n).keys()].some(f);
    edges["--only left"] = any(oh, (j) => on(ox, oy + j));
    edges["--only right"] = any(oh, (j) => on(ox + ow - 1, oy + j));
    edges["--only top"] = any(ow, (i) => on(ox + i, oy));
    edges["--only bottom"] = any(ow, (i) => on(ox + i, oy + oh - 1));
  }
  const hit = Object.keys(edges).filter((k) => edges[k]);
  if (hit.length)
    console.warn(
      `cut: the change reaches the box's ${hit.join(", ")} edge, a straight seam there: keep the edit inside the box`,
    );
  const out = { w: bw, h: bh, data: new Uint8Array(bw * bh * 4) };
  let [x0, y0, x1, y1] = [fw, fh, -1, -1];
  for (let y = 0; y < fh; y++)
    for (let x = 0; x < fw; x++) {
      const p = y * fw + x;
      if (!m[p]) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  for (let y = 0; y < fh; y++)
    for (let x = 0; x < fw; x++) {
      const ox = x + fx - bx;
      const oy = y + fy - by;
      if (ox < 0 || oy < 0 || ox >= bw || oy >= bh) continue;
      const p = y * fw + x;
      const o = (oy * bw + ox) * 4;
      let a = 0;
      if (m[p]) {
        // one pixel of soft edge
        let edge = false;
        for (const q of [p - 1, p + 1, p - fw, p + fw]) if (q >= 0 && q < N && !m[q]) edge = true;
        a = edge ? 150 : 255;
        out.data.set(src.data.subarray(p * 4, p * 4 + 3), o);
      } else if (shadow) {
        // contact shadow: a soft oval under the object's foot
        const rx = (x1 - x0) * 0.58;
        const ry = Math.max(4, (x1 - x0) * 0.1);
        const dx = (x - (x0 + x1) / 2) / rx;
        const dy = (y - (y1 - ry * 0.35)) / ry;
        const d = dx * dx + dy * dy;
        if (d < 1) {
          out.data.set([10, 6, 4], o);
          a = Math.round(120 * (1 - d));
        }
      }
      out.data[o + 3] = a;
    }
  return out;
};

const over = (dst, src, x0, y0) => {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const s = (y * src.w + x) * 4;
      const a = src.data[s + 3] / 255;
      if (!a) continue;
      const d = ((y + y0) * dst.w + x + x0) * 4;
      for (let c = 0; c < 3; c++)
        dst.data[d + c] = Math.round(src.data[s + c] * a + dst.data[d + c] * (1 - a));
    }
};

const blank = (pic, twin, { x, y, w, h }, minLight) => {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) {
      const p = (j * pic.w + i) * 4;
      const [r, g, b] = pic.data.subarray(p, p + 3);
      if (0.3 * r + 0.59 * g + 0.11 * b >= minLight) twin.data.set([255, 0, 255], p);
    }
};

// hubLayout for slot fills S: the table's own overlays, a painted slot's in place of its
// empty ones, the customer's extras, and the painted boxes as quiet (no string-light twinkle)
const layoutFor = (S) => {
  const slots = [...TABLE.always];
  const points = { ...TABLE.points };
  const quiet = [];
  for (const [id, slot] of Object.entries(TABLE.slots)) {
    const mine = S[id] ?? {};
    if (!mine.paint) slots.push(...(slot.layout ?? []), ...(slot.empty ?? []));
    else {
      quiet.push(slot.box);
      Object.assign(points, slot.points);
      for (const s of [...(slot.layout ?? []), ...(slot.filled ?? [])])
        if (s.kind !== "label" || mine.text) slots.push(mine.text ? { ...s, text: mine.text } : s);
    }
    slots.push(...(mine.extra ?? []));
  }
  return { points, quiet, slots };
};

const compose = (customer) => {
  if (!/^[a-z0-9-]+$/.test(customer ?? "")) throw new Error(`customer slug expected, got ${customer}`);
  const jsonFile = `${CUSTOMERS}/${customer}.json`;
  if (!existsSync(jsonFile)) {
    console.error(`no customer file ${jsonFile}`);
    process.exit(1);
  }
  const C = JSON.parse(readFileSync(jsonFile, "utf8"));
  const S = JSON.parse(C.slots || "{}");
  // a fill is a PNG inside the customers folder, never a path out of it
  for (const [id, mine] of Object.entries(S))
    if (mine.paint) {
      slotBox(id);
      const f = resolve(CUSTOMERS, mine.paint);
      if (!f.startsWith(CUSTOMERS + sep) || !existsSync(f)) {
        console.error(`${jsonFile}: slots.${id}.paint names ${mine.paint}, not a file inside ${CUSTOMERS}`);
        process.exit(1);
      }
    }
  const pic = read(VIDEO + TABLE.base);
  const twin = read(VIDEO + TABLE.mask);
  for (const [id, mine] of Object.entries(S)) {
    const slot = TABLE.slots[id];
    if (mine.paint) {
      const f = read(resolve(CUSTOMERS, mine.paint), undefined, undefined, undefined, "png_pipe");
      over(pic, f, slot.box[0], slot.box[1]);
      over(twin, f, slot.box[0], slot.box[1]);
    }
    // a label's blank: the slot's own label box whole, an extra label the light paper in its box
    if (mine.paint && mine.text)
      for (const s of slot.filled ?? []) if (s.kind === "label") blank(pic, twin, s, 0);
    for (const s of mine.extra ?? []) if (s.kind === "label") blank(pic, twin, s, 150);
  }
  const out = `${CUSTOMERS}/${customer}/workshop`;
  mkdirSync(dirname(out), { recursive: true });
  write(`${out}.png`, pic);
  write(`${out}-magenta.png`, twin);
  snap(`${out}.png`, `${out}-960.png`);
  C.hubImage = `${customer}/workshop.png`;
  C.hubMask = `${customer}/workshop-magenta.png`;
  C.hubLayout = JSON.stringify(layoutFor(S));
  writeFileSync(jsonFile, `${JSON.stringify(C, null, 2)}\n`);
};

if (import.meta.main) {
  const [mode, ...a] = process.argv.slice(2);
  if (mode === "crop") crop(a[0], a[1]);
  else if (mode === "cut") {
    // a box is four numbers joined by commas, x,y,w,h in image pixels
    const flag = (f) => {
      const i = a.indexOf(f);
      if (i < 0) return undefined;
      const v = (a[i + 1] ?? "").split(",").map(Number);
      if (v.length !== 4 || !v.every(Number.isFinite) || v[2] <= 0 || v[3] <= 0)
        throw new Error(`${f} wants x,y,w,h (four numbers, commas, no spaces), got ${a[i + 1]}`);
      return v;
    };
    write(a[2], cut(slotBox(a[0]), a[1], flag("--from"), a.includes("--shadow"), flag("--only")));
  } else if (mode === "compose") compose(a[0]);
  else if (mode === "snap") snap(a[0], a[1]);
  else if (mode === "layout") console.log(JSON.stringify(layoutFor({})));
  else {
    console.error("usage: workshop.mjs crop|cut|compose|snap|layout (see the header)");
    process.exit(1);
  }
}
