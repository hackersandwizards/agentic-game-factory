import type Phaser from "phaser";
import { GRID_SCALE } from "../../design/tokens";

// Movement feel, from Celeste's Player.cs (320x180, 8 px tiles). This game's tiles are 48 art px, the
// 16 px of its first version scaled by 3: heights are scaled by 1.75 and run speeds by 1.25 for the
// 16 px tiles, then everything measured in pixels by GRID_SCALE. Speeds in px/s, times in s, which stay.
export const V = 1.75 * GRID_SCALE;
const H = 1.25 * GRID_SCALE;
export const FEEL = {
  maxRun: 90 * H,
  runAccel: 1000 * H,
  runReduce: 400 * H,
  airMult: 0.65,
  gravity: 900 * V,
  maxFall: 160 * V,
  jumpSpeed: 105 * V,
  varJumpTime: 0.2, // holding jump keeps the jump speed this long
  halfGravThreshold: 40 * V, // near the apex, gravity halves while jump is held
  coyoteTime: 0.1, // jump still works this long after running off a ledge
  jumpBuffer: 0.1, // a jump pressed this long before landing still happens
  cornerCorrection: 4 * GRID_SCALE, // px the head slides around a ledge corner instead of bumping
  dashSpeed: 260 * H, // the staff's dash: this fast, straight ahead, gravity off
  dashTime: 0.14,
};

export function approach(value: number, target: number, step: number) {
  return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}

/** Whether tiles that stop an upward jump fill the rectangle. */
export type Solid = (x: number, y: number, w: number, h: number) => boolean;

/** Jumping into a ledge corner by a few pixels slides the head around it, as in Celeste. */
export function correctCorner(
  b: Phaser.Physics.Arcade.Body,
  box: Phaser.GameObjects.Zone,
  solid: Solid,
  dt: number,
) {
  const y = b.y + b.velocity.y * dt;
  if (!solid(b.x, y, b.width, 2)) return;
  const dir = Math.sign(b.velocity.x) || 1;
  for (let d = 1; d <= FEEL.cornerCorrection; d++) {
    for (let side = 1; side >= -1; side -= 2) {
      const dx = d * dir * side;
      if (!solid(b.x + dx, y, b.width, 2)) {
        box.x += dx;
        b.x += dx;
        return;
      }
    }
  }
}
