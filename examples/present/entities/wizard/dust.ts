import type Phaser from "phaser";

/** The dust his feet kick up: one emitter, made before him so it draws under him. */
export function addDust(scene: Phaser.Scene) {
  const dust = scene.add.particles(0, 0, "dust", {
    frequency: -1,
    lifespan: 250,
    speedX: { min: -60, max: 60 },
    speedY: { min: -40, max: -10 },
    scale: { start: 1, end: 0 },
    alpha: { start: 0.8, end: 0 },
  });
  dust.setDepth(9);
  return dust;
}
