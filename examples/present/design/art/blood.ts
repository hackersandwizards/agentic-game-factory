import type Phaser from "phaser";
import { PALETTE } from "./palette";

export function bakeBlood(scene: Phaser.Scene) {
  bakeDrops(scene);
  for (let n = 0; n < 3; n++) bakeSplat(scene, n);
  bakeSplatter(scene);
}

function bakeDrops(scene: Phaser.Scene) {
  if (!scene.textures.exists("drop")) {
    // 18+ mode's spray: round drops 2 to 6 px across, a highlight on top, a dark rim below; one frame each.
    const texture = scene.textures.createCanvas("drop", 25, 6)!;
    const ctx = texture.getContext();
    let left = 0;
    [2, 3, 4, 5, 6].forEach((size, i) => {
      const r = size / 2;
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
          const [dx, dy] = [x + 0.5 - r, y + 0.5 - r];
          if (Math.hypot(dx, dy) > r + 0.2) continue;
          ctx.fillStyle = dy < -r / 3 && dx < 0 ? PALETTE.R : dy > r / 2 ? PALETTE.k : PALETTE.r;
          ctx.fillRect(left + x, y, 1, 1);
        }
      texture.add(i, 0, left, 0, size, size);
      left += size + 1;
    });
    texture.refresh();
  }
}

// 18+ mode's splats on the ground (systems/blood.ts), three of them: a flat pool on the ground's top edge (row 14)
// with a ragged crown of spikes, loose droplets around it, runs down the face below. A fixed seed each.
function bakeSplat(scene: Phaser.Scene, n: number) {
  const key = `splat-${n}`;
  if (scene.textures.exists(key)) return;
  let seed = 7 + n * 101;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const [w, h, edge, rx, ry] = [48, 30, 14, 13, 5];
  const texture = scene.textures.createCanvas(key, w, h)!;
  const ctx = texture.getContext();
  const dot = (x: number, y: number, c: string) => {
    ctx.fillStyle = PALETTE[c];
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };
  const spikes = Array.from({ length: 4 + n }, () => [0.2 + rnd() * 2.7, 0.6 + rnd() * 1.2]);
  for (let y = 0; y <= edge + 1; y++)
    for (let x = 0; x < w; x++) {
      const [dx, dy] = [(x + 0.5 - w / 2) / rx, Math.max(0, edge - y - 0.5) / ry];
      const [e, a] = [Math.hypot(dx, dy), Math.atan2(dy, dx)];
      const reach = Math.max(
        1,
        ...spikes.map(([at, len]) => 1 + len * Math.max(0, 1 - Math.abs(a - at) / 0.2)),
      );
      if (e <= reach) dot(x, y, e > reach - 0.3 ? "k" : rnd() < 0.15 ? "R" : "r");
    }
  for (let i = 0; i < 6; i++) {
    const [a, e] = [rnd() * Math.PI, 1.3 + rnd() * 0.4];
    const [x, y] = [w / 2 + Math.cos(a) * rx * e, edge - Math.sin(a) * ry * e];
    dot(x, y, "R");
    dot(x + 1, y, "r");
    dot(x, y + 1, "r");
    dot(x + 1, y + 1, "k");
  }
  for (let i = 0; i < 2 + n; i++) {
    const x = w / 2 - rx + 2 + Math.floor(rnd() * (rx * 2 - 4));
    const end = edge + 3 + Math.floor(rnd() * 10);
    for (let y = edge + 1; y < end; y++) dot(x, y, "r");
    dot(x, end, "R");
    dot(x, end + 1, "k");
  }
  texture.refresh();
}

function bakeSplatter(scene: Phaser.Scene) {
  if (scene.textures.exists("splatter")) return;
  // 18+ mode's splash on the screen's edge: overlapping discs set pixel by pixel, a darker rim.
  const texture = scene.textures.createCanvas("splatter", 64, 64)!;
  const ctx = texture.getContext();
  const discs = [
    [30, 30, 18],
    [48, 20, 9],
    [14, 46, 8],
    [44, 46, 10],
    [56, 40, 4],
    [8, 22, 5],
    [24, 8, 4],
    [36, 58, 3],
  ];
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const d = Math.min(...discs.map(([cx, cy, r]) => Math.hypot(x - cx, y - cy) - r));
      if (d > 0) continue;
      ctx.fillStyle = d > -1.5 ? PALETTE.k : Math.hypot(x - 23, y - 23) < 5 ? PALETTE.R : PALETTE.r;
      ctx.fillRect(x, y, 1, 1);
    }
  texture.refresh();
}
