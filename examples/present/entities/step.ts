import type Phaser from "phaser";

/** How far time has come from the last physics step toward the next, from 0 to 1. */
export function sinceStep(world: Phaser.Physics.Arcade.World) {
  const { _elapsed, fps } = world as Phaser.Physics.Arcade.World & { _elapsed: number };
  return _elapsed / (1000 / fps);
}
