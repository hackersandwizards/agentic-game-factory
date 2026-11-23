import Phaser from "phaser";
import { HEIGHT, NIGHT, PAD_X, PAD_Y, REDUCED, TINT, WIDTH, ZOOM } from "../../design/tokens";

// Background layers from far to near: texture, scroll speed relative to the camera, y, tint. The tints
// grade them by depth. Each layer ends at the ground line and fades into the dark there, so pits look
// into the night.
const GROUND_LINE = 450;
const FADE = 48;
// On the high route the view's bottom looks down into the valley: the mountains' own lower rows sinking into mist and
// night (studio/scripts/game-art.mjs), laid over the nearer layers from VALLEY_TOP in the mountains texture, full from
// DEEP_FROM px climbed on (the ground line leaves the view at 144) and none at a third of that. The forest and firs
// there read as ground under the pits, and a flat night in their place read as unfinished.
const VALLEY_TOP = 380;
const DEEP_FROM = 180;
// The far layers are darker and duller than the play plane, so the most contrast stays where you play.
// The last number is how far a layer slides down per pixel the camera climbs. The near firs stand on the ground
// and sink with it, the forest and mountains nearly: sliding at their horizontal speeds, the firs filled the
// view's bottom on the high route, where the ground should be, and the platforms seemed to float.
const PARALLAX: [string, number, number, number, number][] = [
  ["sky", 0.05, 0, 0xc0c8dc, 0],
  ["mountains", 0.15, -84, 0x6c7898, 0.5],
  ["forest", 0.35, 114, 0x95a0c0, 0.85],
  ["near", 0.6, 30, 0x606880, 1],
];
// Two thin bands of mist: after which layer they draw, and their middle row in that layer's texture.
const FOG: [number, number][] = [
  [1, 330],
  [2, 300],
];
// The forest cabin's chimney top in the forest texture, where the live smoke rises.
const CHIMNEY = { x: 657, y: 225 };
// The occluder in front of everything passes 1.4 times faster than the camera; this many rows peek up.
const FOREGROUND = { speed: 1.4, show: 110 };
const snap = (x: number) => Math.round(x * ZOOM) / ZOOM;

export class Backdrop {
  layers: Phaser.GameObjects.TileSprite[] = [];
  fogs: Phaser.GameObjects.TileSprite[] = [];
  fade!: Phaser.GameObjects.Graphics;
  private valley!: Phaser.GameObjects.TileSprite;
  foreground!: Phaser.GameObjects.TileSprite;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  private drops!: Phaser.GameObjects.Particles.ParticleEmitter;
  private worldMs = 0; // the world's clock, which a hit-stop stops: the sky and the mist drift on it

  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  addFar() {
    // Fixed to the screen: scroll factor 0 draws at the camera's centre plus the offset from it, so these
    // sit at (PAD_X, PAD_Y) plus their position on the 960x540 view.
    // Between the layers, in drawing order: stars and a shooting star in the sky, mist, chimney smoke.
    this.fogs = [];
    this.layers = PARALLAX.map(([key, , y, tint], i) => {
      const layer = this.scene.add
        .tileSprite(PAD_X, PAD_Y + y, WIDTH, key === "sky" ? HEIGHT : GROUND_LINE - y, key)
        .setOrigin(0)
        .setScrollFactor(0)
        .setTint(tint);
      if (key === "sky") this.addSkyLife();
      if (FOG.some(([after]) => after === i))
        this.fogs.push(
          this.scene.add
            .tileSprite(PAD_X, 0, WIDTH, 48, "fog")
            .setOrigin(0, 0.5)
            .setScrollFactor(0)
            .setTint(TINT.snowShade)
            .setAlpha(0.18),
        );
      if (key === "forest")
        this.smoke = this.scene.add
          .particles(0, 0, "dust", {
            lifespan: 2400,
            speedY: { min: -14, max: -8 },
            speedX: { min: 2, max: 8 },
            scale: { start: 0.6, end: 1.6 },
            alpha: { start: 0.35, end: 0 },
            tint: TINT.snowShade,
            frequency: 260,
          })
          .setScrollFactor(0);
      return layer;
    });
    // Stepped bands, not a smooth gradient, so the fade stays pixel art.
    this.fade = this.scene.add.graphics().setScrollFactor(0);
    [0.25, 0.5, 0.75, 0.95].forEach((alpha, i) =>
      this.fade.fillStyle(NIGHT, alpha).fillRect(PAD_X, (i * FADE) / 4, WIDTH, FADE / 4),
    );
    // Below the fade the night is solid: no sky or stars show under the horizon in a pit.
    this.fade.fillStyle(NIGHT, 1).fillRect(PAD_X, FADE, WIDTH, HEIGHT);
    this.valley = this.scene.add
      .tileSprite(PAD_X, 0, WIDTH, this.scene.textures.getFrame("valley").height, "valley")
      .setOrigin(0)
      .setScrollFactor(0)
      .setTint(PARALLAX[1][3]);
  }

  addMiddle() {
    this.addSnow();
    this.addDrops();
  }

  private addSnow() {
    // Snow: far flakes are single pixels, near ones bigger and faster. advance prefills the sky.
    for (const [texture, speed, count] of [
      ["snow", 24, 70],
      ["flake", 56, 25],
    ] as const) {
      this.scene.add
        .particles(0, 0, texture, {
          x: { min: PAD_X - 40, max: PAD_X + WIDTH + 40 },
          y: PAD_Y - 8,
          lifespan: (HEIGHT + 16) * (1000 / speed),
          speedY: { min: speed * 0.8, max: speed * 1.2 },
          speedX: { min: -12, max: 12 },
          frequency: ((HEIGHT + 16) * (1000 / speed)) / count,
          maxAliveParticles: count,
          advance: (HEIGHT + 16) * (1000 / speed),
          alpha: texture === "snow" ? 0.6 : 0.9,
        })
        .setScrollFactor(0)
        .setDepth(texture === "snow" ? 1 : 20);
    }
  }

  private addDrops() {
    // Firs shed snow when the wizard brushes past them.
    this.drops = this.scene.add
      .particles(0, 0, "flake", {
        frequency: -1,
        lifespan: 900,
        speedX: { min: -30, max: 30 },
        speedY: { min: 0, max: 30 },
        gravityY: 240,
        alpha: { start: 0.9, end: 0 },
      })
      .setDepth(12);
  }

  brush(x: number, y: number) {
    this.drops.explode(6, x, y);
  }

  addNear() {
    this.foreground = this.scene.add
      .tileSprite(PAD_X, 0, WIDTH, 120, "foreground")
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(21);
  }

  advance(dt: number) {
    this.worldMs += dt * 1000;
  }

  draw(climb: number, left: number) {
    // The layers slide down when the camera climbs, the nearer the more; each on whole screen pixels as well.
    for (let i = 0; i < this.layers.length; i++) {
      const speed = PARALLAX[i][1];
      this.layers[i].tilePositionX = snap(left * speed + (i === 0 ? this.worldMs / 400 : 0));
      // Between screen pixels the texture's top edge would also sample its own bottom row.
      if (i > 0) this.layers[i].y = snap(PAD_Y + PARALLAX[i][2] + climb * PARALLAX[i][4]);
    }
    const near = this.layers.at(-1)!;
    this.fade.y = near.y + near.height - FADE;
    const mountains = this.layers[1];
    this.valley.tilePositionX = mountains.tilePositionX;
    this.valley.y = mountains.y + VALLEY_TOP;
    this.valley.setAlpha(Phaser.Math.Clamp((1.5 * climb) / DEEP_FROM - 0.5, 0, 1));
    for (let i = 0; i < this.fogs.length; i++) {
      const after = FOG[i][0];
      const row = FOG[i][1];
      this.fogs[i].y = this.layers[after].y + row;
      this.fogs[i].tilePositionX = snap(left * PARALLAX[after][1] + this.worldMs / 200);
    }
    const forest = this.layers[2];
    const chimney = Phaser.Math.Wrap(CHIMNEY.x - forest.tilePositionX, -330, 1290);
    this.smoke.setPosition(PAD_X + chimney, forest.y + CHIMNEY.y);
    this.foreground.tilePositionX = snap(left * FOREGROUND.speed);
    this.foreground.y = snap(PAD_Y + HEIGHT - FOREGROUND.show + climb * FOREGROUND.speed);
  }

  /** Twinkling stars and, now and then, a shooting star, fixed to the sky. */
  private addSkyLife() {
    for (let i = 0; i < 8; i++) {
      const star = this.scene.add
        .image(PAD_X + 60 + i * 113, PAD_Y + 24 + ((i * 53) % 150), "snow")
        .setScrollFactor(0)
        .setAlpha(0.3);
      if (!REDUCED)
        this.scene.tweens.add({
          targets: star,
          alpha: 1,
          duration: 900,
          yoyo: true,
          repeat: -1,
          delay: i * 370,
        });
    }
    if (REDUCED) return;
    const streak = this.scene.add
      .image(0, 0, "streak")
      .setScrollFactor(0)
      .setOrigin(1, 0)
      .setVisible(false)
      .setAngle(20);
    this.scene.time.addEvent({
      delay: 7000,
      loop: true,
      callback: () => {
        const x = PAD_X + Phaser.Math.Between(200, WIDTH - 100);
        const y = PAD_Y + Phaser.Math.Between(20, 120);
        streak.setPosition(x, y).setAlpha(1).setVisible(true);
        this.scene.tweens.add({ targets: streak, x: x + 160, y: y + 58, alpha: 0, duration: 600 });
      },
    });
  }
}
