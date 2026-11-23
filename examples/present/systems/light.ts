import Phaser from "phaser";
import { HEIGHT, PAD_X, PAD_Y, TINT, WIDTH } from "../design/tokens";

// The night's light mask: the view multiplied by AMBIENT, with light pools added where things glow.
const AMBIENT = 0xb8c0dc;

// A light pool follows obj while it is active and visible: radius in units of 64 px, colour, strength.
type Light = {
  obj: { x: number; y: number; active: boolean; visible: boolean };
  r: number;
  tint: number;
  alpha: number;
};
export class NightLight {
  mask!: Phaser.GameObjects.RenderTexture;
  private pools: Light[] = [];
  private readonly stampCfg = { tint: TINT.white, alpha: 1, scale: 1, blendMode: Phaser.BlendModes.ADD };

  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  add(pool: Light) {
    this.pools.push(pool);
  }

  addMask() {
    // The light mask over the whole world view; it redraws itself every frame (renderMode "all").
    this.mask = this.scene.add
      .renderTexture(PAD_X, PAD_Y, WIDTH, HEIGHT)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(22)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.mask.renderMode = "all";
  }

  draw(left: number, scrollY: number) {
    // The light mask, in view coordinates: everything dims to AMBIENT, then each visible light adds its pool.
    const vy = scrollY + PAD_Y;
    this.mask.clear().fill(AMBIENT);
    const cfg = this.stampCfg;
    for (const light of this.pools) {
      const { obj } = light;
      const x = obj.x - left;
      const y = obj.y - vy;
      if (!obj.active || !obj.visible || x < -128 || y < -128 || x > WIDTH + 128 || y > HEIGHT + 128)
        continue;
      cfg.tint = light.tint;
      cfg.scale = light.r;
      cfg.alpha = light.alpha * ((obj as { alpha?: number }).alpha ?? 1);
      this.mask.stamp("light", undefined, x, y, cfg);
    }
  }
}
