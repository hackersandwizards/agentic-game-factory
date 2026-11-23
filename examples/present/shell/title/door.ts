import Phaser from "phaser";
import { addGlow } from "../../design/art";
import { NIGHT, NIGHT_RGB, REDUCED, TINT } from "../../design/tokens";
import { music, sfx } from "../../systems/sound";
import type { addSwitches } from "./strip";
import { WORKSHOP_WIDTH } from "./workshop";

const door = { x: 296, y: 52, w: 18, h: 40 };

export function buildDoor(scene: Phaser.Scene) {
  // Behind the painted door: the snowy night. The door itself is a cut-out of the picture that swings open.
  // The night and the cut-out stay hidden until Start, so the full-size picture shows the door until then.
  const behind = scene.add.container(0, 0).setVisible(false).setName("night");
  behind.add(scene.add.rectangle(door.x, door.y, door.w, door.h, NIGHT).setOrigin(0));
  for (const [x, y] of [
    [3, 6],
    [11, 14],
    [6, 24],
    [14, 31],
    [8, 36],
  ]) {
    behind.add(scene.add.rectangle(door.x + x, door.y + y, 0.4, 0.4, TINT.snow));
  }
  const k = scene.textures.get("workshop").getSourceImage().width / WORKSHOP_WIDTH;
  scene.textures.get("workshop").add("door", 0, door.x * k, door.y * k, door.w * k, door.h * k);
  const panel = scene.add
    .image(door.x, door.y, "workshop", "door")
    .setOrigin(0)
    .setScale(1 / k);
  behind.add(panel);
  // The camera flies 36 times closer through the door, so its stars are two picture pixels wide and its
  // light is a smooth gradient: stepped pixel rings would grow into blocks.
  const light = scene.add
    .image(door.x + door.w / 2, door.y + door.h / 2, "glow-smooth")
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(TINT.crystal)
    .setAlpha(0)
    .setScale(120 / 256);

  return { behind, panel, light, k };
}

export function makeDoorFlight(
  scene: Phaser.Scene,
  { behind, panel, light, k }: ReturnType<typeof buildDoor>,
  hint: Phaser.GameObjects.Image,
  blink: Phaser.Time.TimerEvent | undefined,
  { speaker, chip }: ReturnType<typeof addSwitches>,
) {
  const { spark, sparkle } = addStaff(scene);
  // The switches fade in with the sparkles. The film never showed them. They start at 0.001, since Phaser skips
  // input on an object at alpha 0 and a tap meant for them would start the game.
  sparkle.setAlpha(0);
  for (const button of [speaker, chip]) button.setAlpha(0.001);
  scene.time.delayedCall(600, () => {
    if (started) return;
    sparkle.start();
    scene.tweens.add({ targets: [sparkle, speaker, chip], alpha: 1, duration: 600 });
  });
  const trail = addTrail(scene, spark);

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    // The board stays lit through the flight into the door: lettering on a plaque does not vanish.
    blink?.remove();
    hint.setTexture("press");
    sparkle.stop();
    // The spark leaves the staff as a brighter light.
    scene.tweens.killTweensOf(spark);
    spark.setBlendMode(Phaser.BlendModes.ADD).setScale(0.3);
    trail.start();
    behind.setVisible(true);
    sfx.lights();
    music.start();
    scene.tweens.chain({
      tweens: [
        {
          targets: spark,
          x: door.x + door.w / 2,
          y: door.y + door.h / 2,
          duration: 800,
          ease: "Sine.inOut",
        },
        {
          targets: panel,
          scaleX: 0.2 / k,
          duration: 400,
          ease: "Quad.out",
          onStart: () => {
            trail.stop();
            spark.destroy();
            sfx.door();
          },
        },
        { targets: light, alpha: 0.9, duration: 300 },
      ],
      onComplete: () => flyIntoDoor(scene),
    });
  };
  return start;
}

function addStaff(scene: Phaser.Scene) {
  // On Start, the wizard's staff sends a spark to the door, the door opens, and we fly through it.
  // Nothing happens before the player starts.
  const staff = { x: 163, y: 61 };
  // As the film's last frame draws it: teal at 0.8 laid over the picture, 6 px in radius, pulsing between
  // 4.8 and 7.2 px every 1.4 s (the glow texture is 48 px in radius).
  const spark = addGlow(scene, staff.x, staff.y, TINT.crystal, 0.8)
    .setBlendMode(Phaser.BlendModes.NORMAL)
    .setScale(6 / 48);
  if (!REDUCED)
    scene.tweens.add({
      targets: spark,
      scale: { from: 4.8 / 48, to: 7.2 / 48 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });
  // The film's last frame shows only the soft glow: the sparkles join after it, fading in.
  const sparkle = scene.add.particles(staff.x, staff.y, "spark", {
    emitting: false,
    lifespan: 600,
    speed: { min: 4, max: 12 },
    scale: { start: 1, end: 0 },
    frequency: 250,
    blendMode: Phaser.BlendModes.ADD,
  });
  return { spark, sparkle };
}

function addTrail(scene: Phaser.Scene, spark: Phaser.GameObjects.Image) {
  return scene.add.particles(0, 0, "spark", {
    follow: spark,
    lifespan: 400,
    speed: { min: 5, max: 20 },
    scale: { start: 1, end: 0 },
    frequency: 30,
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  });
}

function flyIntoDoor(scene: Phaser.Scene) {
  const cam = scene.cameras.main;
  // Asked for less motion: a plain fade instead of the flight through the door.
  if (REDUCED) cam.fadeOut(600, NIGHT_RGB.r, NIGHT_RGB.g, NIGHT_RGB.b);
  else {
    cam.pan(door.x + door.w / 2, door.y + door.h / 2, 700, Phaser.Math.Easing.Quadratic.Out);
    cam.zoomTo(cam.zoom * 6, 1100, Phaser.Math.Easing.Quadratic.In);
    scene.time.delayedCall(500, () => cam.fadeOut(600, NIGHT_RGB.r, NIGHT_RGB.g, NIGHT_RGB.b));
  }
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start("level"));
}
