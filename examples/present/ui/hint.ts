import Phaser from "phaser";
import { TILE } from "../domain/terrain";
import { COLOR, HEIGHT, PAD_X, PAD_Y, TEXT, TEXT_SCALE, WIDTH } from "../design/tokens";
import type { LineRoom } from "./placement";
import type { Bands } from "./bands";

const HELP_Y = 72; // the line on how to play: its top, under the HUD

// The line on how to play fades out and in over HELP_FADE ms each when it moves to the other end of the view.
const HELP_FADE = 75;
export class Hint {
  // The line on how to play shows at helpShow.a times helpSlot.a: shown or hidden, and fading as it moves (HELP_FADE).
  private readonly helpShow = { a: 1 };
  private readonly helpSlot = { a: 1 };
  helpMoving = false;
  help!: Phaser.GameObjects.Text;

  private readonly scene: Phaser.Scene;
  private readonly bands: Bands;
  private readonly popupBox: NonNullable<LineRoom["hint"]> = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    above: false,
  };
  private readonly avoidBox = new Phaser.Geom.Rectangle();
  private readonly lineBox = new Phaser.Geom.Rectangle();
  private readonly slotTween: Phaser.Types.Tweens.TweenBuilderConfig;
  private readonly showTween: Phaser.Types.Tweens.TweenBuilderConfig;

  constructor(scene: Phaser.Scene, bands: Bands, help: string) {
    this.scene = scene;
    this.bands = bands;
    this.slotTween = {
      targets: this.helpSlot,
      a: 0,
      duration: HELP_FADE,
      yoyo: true,
      onYoyo: () => {
        this.help.y = this.help.y === HELP_Y ? HEIGHT - HELP_Y - this.help.displayHeight : HELP_Y;
      },
      onComplete: () => (this.helpMoving = false),
    };
    this.showTween = {
      targets: this.helpShow,
      a: 0,
      delay: 0,
      duration: 600,
      onComplete: () => this.bands.words("below", []),
    };
    this.help = this.bands
      .band(this.scene.add.text(WIDTH / 2, HELP_Y, "", TEXT).setScale(TEXT_SCALE))
      .setShadow(1, 1, COLOR.outline, 0, false, true)
      .setAlign("center")
      .setLineSpacing(2)
      .setOrigin(0.5, 0)
      .setDepth(30)
      .setName("controls");
    this.show(help); // until `dismissOnMove`
  }

  avoid(him: Phaser.Geom.Rectangle, cam: Phaser.Cameras.Scene2D.Camera) {
    // The line on how to play goes to the other end of the view as he comes near it: on the first high route it lay
    // across his hat. It fades out, moves and fades in: it jumped from end to end in one frame. Near is within the way
    // he can move while it fades out, 64 px up or down at his fastest fall or bounce, 32 px across. In view pixels, as
    // the UI camera draws it.
    this.avoidBox.setTo(
      him.x - cam.scrollX - PAD_X - 32,
      him.y - cam.scrollY - PAD_Y - 64,
      him.width + 64,
      him.height + 128,
    );
    this.help.alpha = this.helpShow.a * this.helpSlot.a;
    if (
      !this.helpMoving &&
      this.help.visible &&
      this.help.alpha &&
      Phaser.Geom.Intersects.RectangleToRectangle(this.avoidBox, this.help.getBounds(this.lineBox))
    ) {
      this.helpMoving = true;
      this.scene.tweens.add(this.slotTween);
    }
  }

  popupBounds(left: number, top: number) {
    if (!this.help.visible || !this.help.alpha) return;
    const help = this.help.getBounds(this.lineBox);
    const bounds = this.popupBox;
    bounds.left = left + help.x;
    bounds.right = left + help.right;
    bounds.top = top + help.y;
    bounds.bottom = top + help.bottom;
    bounds.above = this.help.y === HELP_Y;
    return bounds;
  }

  remove() {
    this.scene.tweens.killTweensOf(this.help);
    this.help.destroy();
  }

  stop() {
    this.scene.tweens.killTweensOf([this.helpShow, this.helpSlot]);
  }

  /** The line on how to play, under the HUD, for `ms` before it fades, or until hide without `ms`. */
  show(text: string, ms?: number) {
    this.scene.tweens.killTweensOf(this.helpShow);
    this.helpShow.a = 1;
    this.help.setText(text).setVisible(!this.bands.upright).setY(HELP_Y);
    // In the band a line wraps only after a comma: "4600" once wrapped onto a line of its own.
    this.bands.words(
      "below",
      text.split("\n").map((line) => [[line.replace(/(?<!,) /g, "\u00a0"), COLOR.snow]]),
    );
    if (ms !== undefined) this.hide(ms);
  }

  hide(delay = 0) {
    this.showTween.delay = delay;
    this.scene.tweens.add(this.showTween);
  }
  private helpWaits = true; // the controls line shows until he first moves
  private dashTaught = false;

  dismissOnMove(moved: boolean) {
    if (!this.helpWaits || !moved) return false;
    this.helpWaits = false;
    this.hide();
    return true;
  }

  teachDash(px: number, firstPit: number, touch: boolean) {
    // The first gap is where a dash first pays: the line says how, once, as he comes up to it.
    if (!this.dashTaught && px > firstPit - 5 * TILE) {
      this.dashTaught = true;
      // On touch "TAP DASH", the button's own label: "JUMP, THEN DASH BUTTON TO DASH" broke after "JUMP," upright.
      this.show(touch ? "JUMP, THEN TAP DASH" : "JUMP, THEN X TO DASH", 3000);
    }
  }
}
