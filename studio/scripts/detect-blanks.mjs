// Finds the magenta (#FF00FF) blanks in a generated workshop image and prints their bounding
// boxes in image pixels, so overlays can sit on them. Needs ffmpeg on PATH.
// Usage: bun scripts/detect-blanks.mjs greeting/assets/workshop-x-magenta.png
import { read } from "./workshop.mjs";

const { w: W, h: H, data } = read(process.argv[2]);
const isMagenta = (i) => data[i * 4] > 190 && data[i * 4 + 1] < 90 && data[i * 4 + 2] > 190;
const seen = new Uint8Array(W * H);
const boxes = [];
for (let start = 0; start < W * H; start++) {
  if (seen[start] || !isMagenta(start)) continue;
  let [x0, y0, x1, y1, n] = [W, H, 0, 0, 0];
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % W;
    const y = (p - x) / W;
    n++;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
    for (const q of [p - 1, p + 1, p - W, p + W]) {
      if (q < 0 || q >= W * H || seen[q] || Math.abs((q % W) - x) > 1) continue;
      if (isMagenta(q)) {
        seen[q] = 1;
        stack.push(q);
      }
    }
  }
  if (n >= 60)
    boxes.push({
      x: x0,
      y: y0,
      w: x1 - x0 + 1,
      h: y1 - y0 + 1,
      fill: +(n / ((x1 - x0 + 1) * (y1 - y0 + 1))).toFixed(2),
    });
}
boxes.sort((a, b) => a.y - b.y || a.x - b.x);
console.log(JSON.stringify({ width: W, height: H, boxes }, null, 1));
