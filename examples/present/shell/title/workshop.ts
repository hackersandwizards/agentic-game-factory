import Phaser from "phaser";
import { addGlow } from "../../design/art";
import { REDUCED, SCREEN_W, TINT } from "../../design/tokens";

// The title keeps the video's 320x180 grid, at 6 screen pixels per pixel.
export const WORKSHOP_WIDTH = 320;
export const WORKSHOP_HEIGHT = 180;

export function showWorkshop(scene: Phaser.Scene) {
  // The workshop from the video on the game's 960x540 art grid, so the film's last frame cuts straight into
  // the game. It fills the 320x180 grid; the camera draws that grid 6 times larger, 2 screen pixels per
  // picture pixel. The camera never leaves the picture, also not during the door zoom.
  scene.cameras.main
    .setZoom(SCREEN_W / WORKSHOP_WIDTH)
    .setBounds(0, 0, WORKSHOP_WIDTH, WORKSHOP_HEIGHT)
    .centerOn(WORKSHOP_WIDTH / 2, WORKSHOP_HEIGHT / 2);
  scene.add.image(0, 0, "workshop").setOrigin(0).setDisplaySize(WORKSHOP_WIDTH, WORKSHOP_HEIGHT);
}

export function addBeltLights(scene: Phaser.Scene) {
  // The belt's lamps pulse. Their light is a smooth gradient, since stepped rings band at 6 times, and it is
  // drawn before the strip, which covers what would spill over its top edge.
  if (!scene.textures.exists("glow-smooth")) {
    const texture = scene.textures.createCanvas("glow-smooth", 256, 256)!;
    const ctx = texture.getContext();
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgba(255,255,255,0.5)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    texture.refresh();
  }
  [96, 114, 134, 152, 172, 194, 214, 234].forEach((x, i) => {
    const bulb = addGlow(scene, x, 146, TINT.amber, REDUCED ? 0.4 : 0.1)
      .setTexture("glow-smooth")
      .setScale(14.4 / 128);
    if (!REDUCED)
      scene.tweens.add({
        targets: bulb,
        alpha: 0.7,
        duration: 300,
        yoyo: true,
        repeat: -1,
        repeatDelay: 1800,
        delay: i * 150,
      });
  });
}

export function addWindowSnow(scene: Phaser.Scene) {
  // The picture waits for the player, so it keeps living: snow past the window, the belt's lamps (above), a
  // sparkle at the staff.
  // Flakes are 1 px, so a death zone at the glass clips them as a mask would, without a filter pass per frame.
  const glass = new Phaser.Geom.Rectangle(29, 24, 61, 62);
  scene.add.particles(0, 0, "snow", {
    x: { min: 30, max: 89 },
    y: 25,
    lifespan: 4000,
    speedY: { min: 12, max: 20 },
    speedX: { min: -4, max: 4 },
    frequency: 120,
    advance: 4000,
    deathZone: { type: "onLeave", source: glass },
  });
}
