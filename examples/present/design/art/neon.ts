import type Phaser from "phaser";
import { COLOR } from "../tokens";

/**
 * The neon sign, drawn on the level's 960x540 grid: a dark board in a green neon tube (outline, dark tube
 * edge, tube, bright core, tube, edge, the tube's light on the board), on two steel posts with base
 * plates. entities/eggs.ts writes on it.
 */
export function neonSign(scene: Phaser.Scene) {
  const [w, h] = [280, 192];
  const texture = scene.textures.createCanvas("neon-sign", w, h)!;
  const ctx = texture.getContext();
  const rect = (color: string, x: number, y: number, rw: number, rh: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, rw, rh);
  };
  for (const x of [16, w - 28]) {
    rect(COLOR.outline, x, 0, 12, h - 6); // post: outline, light edge, steel, shadow
    rect("#8aa4c8", x + 2, 2, 2, h - 10);
    rect("#3d5684", x + 4, 2, 4, h - 10);
    rect("#1d2b4a", x + 8, 2, 2, h - 10);
    rect(COLOR.outline, x - 8, h - 8, 28, 8); // base plate
    rect("#6d84b0", x - 6, h - 6, 24, 2);
    rect("#2a3a5c", x - 6, h - 4, 24, 2);
  }
  const board = { y: 6, h: 60 };
  let inset = 0;
  for (const [color, width] of [
    [COLOR.outline, 2],
    ["#166534", 1],
    ["#22c55e", 2],
    ["#dcfce7", 2],
    ["#22c55e", 2],
    ["#166534", 1],
    ["#103424", 4],
    ["#0e1f29", 0],
  ] as const) {
    rect(color, inset, board.y + inset, w - 2 * inset, board.h - 2 * inset);
    inset += width;
  }
  for (const [x, y] of [
    [0, board.y],
    [w - 2, board.y],
    [0, board.y + board.h - 2],
    [w - 2, board.y + board.h - 2],
  ])
    ctx.clearRect(x, y, 2, 2); // rounded corners
  for (let x = 18; x < w - 18; x += 26) rect("#13293a", x, board.y + 16 + ((x * 7) % 26), 4, 1); // grain
  texture.refresh();
}
