import type Phaser from "phaser";
import { onKey } from "../systems/keys";
import { sfx } from "../systems/sound";

const KONAMI = "ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight KeyB KeyA";

/**
 * The Konami code, on the title or in the level, throws confetti across a view `width` pixels wide;
 * `place` puts the emitter where it stays fixed on screen. The registry counts it for the tests.
 */
export function listenForKonami(
  scene: Phaser.Scene,
  width: number,
  place: (confetti: Phaser.GameObjects.Particles.ParticleEmitter) => void = () => {},
) {
  const k = width / 320; // speeds and size were tuned on the 320 px title
  let typed: string[] = [];
  onKey(scene, "keydown", (event) => {
    if (event.repeat) return;
    typed = [...typed, event.code].slice(-10);
    if (typed.join(" ") !== KONAMI) return;
    typed = [];
    scene.registry.set("konami", (scene.registry.get("konami") ?? 0) + 1);
    sfx.flourish();
    const confetti = scene.add
      .particles(0, 0, "confetti", {
        frame: [0, 1, 2, 3, 4],
        x: { min: 0, max: width },
        y: -4,
        speedY: { min: 40 * k, max: 110 * k },
        speedX: { min: -30 * k, max: 30 * k },
        rotate: { min: 0, max: 360 },
        scale: k,
        lifespan: 2200,
        quantity: 3,
        frequency: 30,
        duration: 900,
      })
      .setDepth(45);
    place(confetti);
    scene.time.delayedCall(3500, () => confetti.destroy());
  });
}
