import type Phaser from "phaser";
import { COLOR } from "../tokens";

export function bakeLight(scene: Phaser.Scene) {
  if (!scene.textures.exists("light")) {
    // The light mask's pools (systems/light.ts): light falloff is no pixel art, so this one is a smooth gradient.
    const texture = scene.textures.createCanvas("light", 128, 128)!;
    const ctx = texture.getContext();
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.5, "rgba(255,255,255,0.45)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    texture.refresh();
  }
}

export function bakeFog(scene: Phaser.Scene) {
  if (!scene.textures.exists("fog")) {
    // A thin band of mist between the background layers: densest in its middle row, smooth like the light.
    const texture = scene.textures.createCanvas("fog", 64, 48)!;
    const ctx = texture.getContext();
    const gradient = ctx.createLinearGradient(0, 0, 0, 48);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.5, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 48);
    texture.refresh();
  }
}

export function bakeGlow(scene: Phaser.Scene) {
  if (!scene.textures.exists("glow")) {
    // Eight stepped rings instead of a smooth gradient, so the light stays pixel art. Each ring adds its
    // alpha over the larger ones.
    const texture = scene.textures.createCanvas("glow", 96, 96)!;
    const ctx = texture.getContext();
    ctx.fillStyle = COLOR.white;
    for (let ring = 8; ring >= 1; ring--) {
      ctx.globalAlpha = 0.1 + (8 - ring) * 0.02;
      ctx.beginPath();
      ctx.arc(48, 48, ring * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    texture.refresh();
  }
}
