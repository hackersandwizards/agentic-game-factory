import type Phaser from "phaser";
import { COLOR } from "../design/tokens";
import { ATLAS } from "../design/art";
import { muted } from "../systems/sound";

// Upright, the HUD is HTML in the band above the canvas (see hud.ts).
export const HUD_HTML = document.getElementById("hud")!;

export type HudScore = { lives: number; crystals: number; totalCrystals: number; secret: boolean };
type CanvasHud = {
  icon: Phaser.GameObjects.Image;
  hud: Phaser.GameObjects.Text;
  timer: Phaser.GameObjects.Text;
  hearts: Phaser.GameObjects.Image[];
  chip?: Phaser.GameObjects.Image;
};

/**
 * Upright, the HUD as HTML in the band above the canvas: the same icons from their textures, half a CSS px an
 * art pixel beside the 12 px text as on the canvas, and the speaker a 44 px button. Returns what copies the
 * canvas HUD's state over.
 */
export function copyHudToHtml(scene: Phaser.Scene, canvas: CanvasHud, stats: HudScore, mute: () => void) {
  const url = (key: string, frame?: string) => scene.textures.getBase64(key, frame);
  const image = (key: string, frame?: string) => {
    const img = document.createElement("img");
    img.src = url(key, frame);
    img.width = scene.textures.getFrame(key, frame).width / 2;
    return img;
  };
  const [full, empty, on, off] = [
    url("atlas", ATLAS.heart),
    url("atlas", ATLAS.heartEmpty),
    url("hud-speaker"),
    url("hud-speaker-off"),
  ];
  const crystal = image("atlas", ATLAS.crystal);
  const count = document.createElement("span");
  const secret = image("atlas", ATLAS.secret);
  const hearts = canvas.hearts.map(() => image("atlas", ATLAS.heart));
  const button = document.createElement("button");
  button.ariaLabel = "sound";
  const speaker = button.appendChild(image("hud-speaker"));
  // Blurred after the tap, so a later Enter or Space reaches the game, not the button.
  button.onclick = () => {
    mute();
    button.blur();
  };
  const time = document.createElement("span");
  HUD_HTML.replaceChildren(
    crystal,
    count,
    secret,
    ...hearts,
    button,
    ...(canvas.chip ? [image("hud-chip")] : []),
    time,
  );
  // A tinted icon (the count's amber flash, the emptied heart's red one) as its shape filled with the colour.
  const fill = (img: HTMLImageElement, icon: Phaser.GameObjects.Image, color: string) =>
    (img.style.cssText = icon.isTinted
      ? `background:${color};mask:url(${img.src}) 0 0/100%;object-position:-99px`
      : "");
  return () => {
    fill(crystal, canvas.icon, COLOR.gold);
    count.textContent = canvas.hud.text;
    count.style.color = typeof canvas.hud.style.color === "string" ? canvas.hud.style.color : "";
    secret.hidden = !stats.secret;
    for (let i = 0; i < hearts.length; i++) {
      const heart = hearts[i];
      heart.src = i < stats.lives ? full : empty;
      fill(heart, canvas.hearts[i], COLOR.red);
    }
    speaker.src = muted ? off : on;
    button.ariaPressed = String(!muted);
    time.textContent = canvas.timer.text;
    time.style.color = typeof canvas.timer.style.color === "string" ? canvas.timer.style.color : "";
  };
}
