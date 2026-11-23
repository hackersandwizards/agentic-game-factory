import Phaser from "phaser";
import { ATLAS } from "../design/art";
import { COLOR, HW, PORTRAIT, TEXT, TEXT_SCALE, TINT, WIDTH } from "../design/tokens";
import { onKey } from "../systems/keys";
import { gore } from "../systems/blood";
import { muted, toggleMute } from "../systems/sound";
import { LIVES } from "../domain/combat";
import { earnsGold, formatClock as clock } from "../domain/score";
import type { Bands } from "./bands";
import { copyHudToHtml, HUD_HTML } from "./hud-html";
import type { HudScore } from "./hud-html";

/**
 * A HUD icon centred at x and the HUD's middle row, its top-left corner on a whole art pixel as the text's is: an
 * odd-sized icon centred on a whole pixel sat half an art pixel off the text's grid.
 */
const grid = (icon: Phaser.GameObjects.Image, x: number) =>
  icon.setPosition(
    Math.round(x - icon.width / 2) + icon.width / 2,
    Math.round(30 - icon.height / 2) + icon.height / 2,
  );

export class Hud {
  hud!: Phaser.GameObjects.Text;
  timer!: Phaser.GameObjects.Text;
  private second = 0; // the run's time the timer shows, in s
  private secretIcon!: Phaser.GameObjects.Image;
  hearts: Phaser.GameObjects.Image[] = [];
  icon!: Phaser.GameObjects.Image;
  hudBacking!: Phaser.GameObjects.Rectangle;
  private hudBox!: Phaser.GameObjects.Container;
  private hudHtml?: () => void; // `watchResize` connects the HTML HUD
  private speaker!: Phaser.GameObjects.Image;
  chip?: Phaser.GameObjects.Image;

  private readonly scene: Phaser.Scene;
  private readonly bands: Bands;
  private readonly stats: HudScore;

  constructor(scene: Phaser.Scene, bands: Bands, stats: HudScore) {
    this.scene = scene;
    this.bands = bands;
    this.stats = stats;
  }

  addCanvas() {
    // The HUD and every panel draw on the UI camera, on the same 960x540 grid but never scrolling.
    // A dark backing keeps the count readable over snow and stone.
    // Text draws 3 times larger, the size it had on the 320x180 screen; the icons on the 960x540 grid itself.
    // The hearts and the speaker follow the count (see update), so no gap opens between them.
    const backing = (this.hudBacking = this.scene.add.rectangle(6, 6, 408, 50, TINT.outline).setOrigin(0));
    const icon = (this.icon = this.scene.add.image(28, 30, "atlas", ATLAS.crystal));
    this.hud = this.scene.add.text(52, 18, "", TEXT).setScale(TEXT_SCALE);
    // The secret crystal's own purple icon follows its "+1" once found.
    this.secretIcon = grid(this.scene.add.image(0, 30, "atlas", ATLAS.secret).setVisible(false), 0);
    this.hearts = Array.from({ length: LIVES }, () => this.scene.add.image(0, 30, "atlas", ATLAS.heart));
    // The speaker shows whether sound is on; a tap on it mutes, like M.
    const speaker = (this.speaker = this.scene.add
      .image(390, 30, muted ? "hud-speaker-off" : "hud-speaker")
      .setName("speaker"));
    this.mute = () => {
      const off = toggleMute();
      if (speaker.active) speaker.setTexture(off ? "hud-speaker-off" : "hud-speaker"); // the end screen removes the HUD
      this.hudHtml?.();
    };
    speaker.on("pointerdown", this.mute);
    onKey(this.scene, "keydown-M", this.mute);
    // In 18+ mode its chip shows after the speaker.
    this.chip = gore ? this.scene.add.image(0, 30, "hud-chip") : undefined;
    // The run's time, rounded as the win panel rounds it, gold while it still makes the gold time.
    this.second = 0;
    this.timer = this.scene.add
      .text(0, 18, clock(0), { ...TEXT, color: COLOR.gold })
      .setScale(TEXT_SCALE)
      .setName("timer");
    const parts = [
      backing,
      icon,
      this.hud,
      this.secretIcon,
      ...this.hearts,
      this.timer,
      speaker,
      ...(this.chip ? [this.chip] : []),
    ];
    this.hudBox = this.bands
      .ui(this.scene.add.container(0, 0, parts))
      .setDepth(30)
      .setName("hud");
  }

  private mute!: () => void;

  watchResize(clampLines: () => void) {
    const { hudBox, speaker } = this;
    // Upright, the canvas shows small: there the HUD is HTML in the empty band above it (index.html), its text at
    // 12 CSS px as the other bands, and the canvas keeps the whole view. The canvas HUD stays on the world's grid,
    // 1 art pixel an art pixel; it grew to 1.23 there once, half a pixel off the world, and hid the wizard.
    this.hudHtml = copyHudToHtml(this.scene, this, this.stats, this.mute);
    // The speaker's hit area is at least 44 CSS px and 48 art px square and starts no higher than the canvas's top edge.
    const hit = new Phaser.Geom.Rectangle();
    const fitHud = () => {
      if (!hudBox.active) return; // the end screen removed it
      hudBox.setVisible(!PORTRAIT.matches);
      HUD_HTML.hidden = !PORTRAIT.matches;
      clampLines();
      const size = Math.max(48, Math.ceil(44 / (this.scene.scale.displaySize.width / WIDTH)) + 1); // 1 px spare: 44 exactly measured 43.99999
      const top = Math.max((speaker.height - size) / 2, speaker.height / 2 - speaker.y);
      hit.setTo((speaker.width - size) / 2, top, size, size);
    };
    fitHud();
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, fitHud);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.scale.off(Phaser.Scale.Events.RESIZE, fitHud);
      HUD_HTML.hidden = true;
    });
    speaker.setInteractive(hit, (rect: Phaser.Geom.Rectangle, x: number, y: number) => rect.contains(x, y));
  }

  updateTime(second: number) {
    if (second !== this.second) {
      this.timer
        .setText(clock((this.second = second)))
        .setColor(earnsGold(second) ? COLOR.gold : HW.ampersand);
      this.hudHtml?.();
    }
  }

  remove() {
    this.hudBox.destroy();
    this.hudHtml = undefined;
    HUD_HTML.hidden = true;
  }

  /** How far down the view the canvas HUD reaches: 0 where it is gone or HTML (upright). */
  get height() {
    return this.hudBox.active && this.hudBox.visible ? this.hudBacking.y + this.hudBacking.height : 0;
  }

  update() {
    this.hud.setText(`${this.stats.crystals}/${this.stats.totalCrystals}${this.stats.secret ? " +1" : ""}`);
    let end = 52 + this.hud.displayWidth;
    if (this.stats.secret) {
      grid(this.secretIcon.setVisible(true), end + 4 + this.secretIcon.width / 2);
      end += 4 + this.secretIcon.width;
    }
    const x = end + 36;
    this.hearts.forEach((heart, i) =>
      grid(heart.setFrame(i < this.stats.lives ? ATLAS.heart : ATLAS.heartEmpty), x + i * 32),
    );
    grid(this.icon, 28);
    grid(this.speaker, x + LIVES * 32 + 14);
    if (this.chip) grid(this.chip, this.speaker.x + 45);
    this.timer.setX(Math.round((this.chip ? this.chip.x + 26 : this.speaker.x + 18) + 20));
    this.hudBacking.setSize(this.timer.x + this.timer.displayWidth + 12 - 6, 50);
    this.hudHtml?.();
  }

  flashCrystal() {
    // The count and its icon flash light amber for a moment.
    this.hud.setColor(COLOR.gold);
    this.icon.setTint(TINT.gold).setTintMode(Phaser.TintModes.FILL);
    this.hudHtml?.();
    this.scene.time.delayedCall(120, () => {
      this.hud.setColor(COLOR.snow);
      this.icon.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      this.hudHtml?.();
    });
  }

  flashHeart(lives: number) {
    // The heart that empties flashes red, the wizard flashes white, the camera kicks away from the bug.
    // Nothing else flashes: a full-screen wash read heavier than the hit.
    const heart = this.hearts[lives];
    heart.setTint(TINT.red).setTintMode(Phaser.TintModes.FILL);
    this.hudHtml?.();
    this.scene.time.delayedCall(150, () => {
      if (heart.active) heart.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      this.hudHtml?.();
    });
  }
}
