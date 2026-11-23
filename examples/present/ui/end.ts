import Phaser from "phaser";
import { COLOR, HEIGHT, REDUCED, TEAL, TEXT, TEXT_SCALE, TINT, WIDTH } from "../design/tokens";
import { onKey } from "../systems/keys";
import { music } from "../systems/sound";
import { INVITE, INVITE_BAND } from "./bands";
import type { Bands } from "./bands";
import type { Hint } from "./hint";
import type { Hud } from "./hud";

import type { Touch } from "./touch";

const RESTART_DELAY = 1200; // the end panel ignores input this long; GAME OVER takes a fresh press at once

export class End {
  private readonly scene: Phaser.Scene;
  private readonly bands: Bands;
  private readonly hud: Hud;
  private readonly hint: Hint;
  private readonly controls: Touch;

  constructor(scene: Phaser.Scene, bands: Bands, hud: Hud, hint: Hint, controls: Touch) {
    this.scene = scene;
    this.bands = bands;
    this.hud = hud;
    this.hint = hint;
    this.controls = controls;
  }

  showGameOver(crystals: number, totalCrystals: number, touch: boolean) {
    this.prepare(false);
    const lines: [string, string][] = [
      ["GAME OVER", COLOR.amber],
      [`CRYSTALS ${crystals}/${totalCrystals}`, COLOR.crystal],
      [touch ? "TAP TO TRY AGAIN" : "ENTER: TRY AGAIN", COLOR.snow],
    ];
    // The panels keep the original 320x180 layout, drawn 3 times larger.
    const panel = this.scene.add.container(0, 0).setScale(TEXT_SCALE).setDepth(40);
    // 8 px above the first line and below the last one.
    panel.add(
      this.scene.add
        .rectangle(WIDTH / TEXT_SCALE / 2, 64, 168, 52, TINT.outline, 0.9)
        .setStrokeStyle(1, TEAL),
    );
    lines.forEach(([text, color], i) =>
      panel.add(
        this.scene.add.text(WIDTH / TEXT_SCALE / 2, 46 + i * 14, text, { ...TEXT, color }).setOrigin(0.5, 0),
      ),
    );
    this.bands.band(panel);
    this.bands.words(
      "above",
      lines.map((line) => [line]),
    );
    // The last line, how to try again, pulses and stays readable.
    if (!REDUCED)
      this.scene.tweens.add({
        targets: panel.list.at(-1),
        alpha: 0.7,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
  }

  /**
   * Shared by GAME OVER and the end panel: the play controls and music go, the repo URL, its QR code
   * and the invitation slide up from the bottom. A fresh Enter or Space, or a tap, restarts: on GAME OVER at once, as
   * its panel shows (an Enter pressed right after dying was lost, so the player pressed twice), on the end panel after
   * RESTART_DELAY. A key held from before (and its auto-repeat) never counts: only a new press after it went up. A tap
   * counts anywhere on the page: upright, taps on the bands, "TAP TO TRY AGAIN" among them, did nothing.
   */
  prepare(won: boolean) {
    this.hud.remove();
    // The line's fade would clear the band below, which now holds the invitation.
    this.hint.stop();
    this.controls.remove();
    this.hint.remove();
    music.stop();
    const [w, h] = [WIDTH / TEXT_SCALE, HEIGHT / TEXT_SCALE];
    const footer = this.scene.add
      .container(0, 50 * TEXT_SCALE)
      .setScale(TEXT_SCALE)
      .setDepth(40);
    footer.add(this.scene.add.rectangle(0, h - 46, w, 46, TINT.outline, 0.85).setOrigin(0));
    // One margin of 4 around the text and the QR code; lines of a pair 1 apart, the pairs 4 apart.
    footer.add(this.scene.add.image(w - 4, h - 42, "qr").setOrigin(1, 0));
    const say = (y: number, text: string, color: string) =>
      footer.add(this.scene.add.text(4, h - y, text, { ...TEXT, color }));
    const [prompt, repository] = INVITE;
    say(42, prompt.lines[0], prompt.color);
    say(33, prompt.lines[1], prompt.color);
    say(21, repository.lines[0], repository.color);
    say(12, repository.lines[1], repository.color);
    this.bands.band(footer);
    this.bands.words("below", INVITE_BAND);
    this.scene.tweens.add({ targets: footer, y: 0, duration: 400, delay: 600, ease: "Quad.out" });
    const listen = () => {
      const restart = () => this.scene.scene.restart();
      onKey(this.scene, "keydown", (event) => {
        if (!event.repeat && (event.code === "Enter" || event.code === "Space")) restart();
      });
      document.addEventListener("pointerdown", restart, { once: true });
      this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        document.removeEventListener("pointerdown", restart),
      );
    };
    if (won) this.scene.time.delayedCall(RESTART_DELAY, listen);
    else listen();
  }
}
