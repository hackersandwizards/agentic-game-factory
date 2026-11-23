import Phaser from "phaser";
import { COLOR, HEIGHT, PAD_X, PAD_Y, TEXT, TEXT_SCALE } from "../design/tokens";
import type { Hint } from "./hint";
import { findLinePlacement, lineLimit } from "./placement";
import type { LineRoom } from "./placement";

// Whom the lines keep clear of: read off his body, his frame and the way he faces.
type Wizard = { body: Phaser.Physics.Arcade.Body; sprite: Phaser.GameObjects.Sprite; facing: number };
type Flat = { x: number; y: number; displayWidth: number; displayHeight: number };

export class Popups {
  lines: Phaser.GameObjects.Text[] = []; // the live popups and the terminal's greeting (see place)
  private readonly lineBox = new Phaser.Geom.Rectangle();

  private readonly scene: Phaser.Scene;
  private readonly wizard: Wizard;
  private readonly depth: () => number;
  private readonly hint: () => Hint;
  private readonly hudHeight: () => number;
  private readonly room: LineRoom = { top: 0, bottom: 0 };

  constructor(
    scene: Phaser.Scene,
    wizard: Wizard,
    depth: () => number,
    hint: () => Hint,
    hudHeight: () => number,
  ) {
    this.scene = scene;
    this.wizard = wizard;
    this.depth = depth;
    this.hint = hint;
    this.hudHeight = hudHeight;
  }

  /** A line of amber text that rises and fades where something happened (see place): points, the d20. */
  popup(x: number, y: number, text: string, placement: { hold: number; bounce?: boolean; flat?: Flat }) {
    const line = this.scene.add
      .text(x, y, text, { ...TEXT, color: COLOR.gold })
      .setOrigin(0.5, 1)
      .setScale(TEXT_SCALE)
      .setDepth(this.depth()); // above the night's light mask, which turned the amber olive
    this.place(line, 48, placement.bounce, placement.flat);
    this.scene.tweens.add({
      targets: line,
      alpha: 0,
      delay: placement.hold,
      duration: 700,
      onComplete: () => line.destroy(),
    });
  }

  /**
   * Puts a line of text (origin 0.5, 1) where it covers nothing, and keeps it among the live lines until it is
   * destroyed. Clear means in the space from `measureRoom`, 8 px off the wizard's frame (it showed on his face) and off every
   * live line along the way it rises: "+100" landed on "hello, world".
   * Tried in turn: where it is, stacked above what it meets, stacked below it, then the same beside him on the side he
   * comes from and on the other. With `bounce` (a stomp) his frame reaches up to the view's top, the way he bounces.
   * A `flat` squished bug and the ground under it, down to the view's bottom, count too: stacked under his feet,
   * "+100" sat on the bug and hid its white flash. It may rise by up to `rise` as it fades, as far as `keepClear` allows.
   */
  place(line: Phaser.GameObjects.Text, rise: number, bounce = false, flat?: Flat) {
    // Read off his body: his sprite follows it only after the physics step that called this. His frame at least
    // unscaled: squashed by a dash, his head sat lower than it would a moment later.
    const [body, sprite, view] = [this.wizard.body, this.wizard.sprite, this.scene.cameras.main.worldView];
    const [w, h, x0, y0] = [line.displayWidth, line.displayHeight, line.x, line.y];
    const half = Math.max(sprite.width, sprite.displayWidth) / 2 + 8;
    const him = {
      left: body.center.x - half,
      right: body.center.x + half,
      top: bounce ? view.y : body.bottom - Math.max(sprite.height, sprite.displayHeight) - 8,
      bottom: body.bottom + 8,
    };
    const ways = this.lines.map((l) => ({
      left: l.x - l.displayWidth / 2,
      right: l.x + l.displayWidth / 2,
      top: (l.getData("y") as number) - l.displayHeight - (l.getData("rise") as number),
      bottom: l.y,
    }));
    if (flat)
      ways.push({
        left: flat.x - flat.displayWidth / 2,
        right: flat.x + flat.displayWidth / 2,
        top: flat.y - flat.displayHeight,
        bottom: view.bottom,
      });
    const behind = body.velocity.x ? -Math.sign(body.velocity.x) : -this.wizard.facing;
    const [left, right] = [view.x + 8 + w / 2, view.right - 8 - w / 2]; // 8 px inside the view's edges
    const side = behind * (half + w / 2);
    const point = findLinePlacement(
      {
        x: x0,
        y: y0,
        width: w,
        height: h,
        left,
        right,
        beside: body.center.x + side,
        across: body.center.x - side,
      },
      [him, ...ways],
      this.measureRoom(),
    );
    line.setPosition(point.x, point.y);
    line.setData({ y: line.y, rise });
    this.lines.push(line);
    line.once(Phaser.GameObjects.Events.DESTROY, () => this.lines.splice(this.lines.indexOf(line), 1));
  }

  /** Keeps the live lines inside the view's edges after the phone turns (see place). */
  clamp() {
    const view = this.scene.cameras.main.worldView;
    for (const line of this.lines)
      line.x = Phaser.Math.Clamp(
        line.x,
        view.x + 8 + line.displayWidth / 2,
        view.right - 8 - line.displayWidth / 2,
      );
  }

  /**
   * The world y a line of text `w` wide centred on x keeps between: under the canvas HUD, above the view's bottom, and
   * off the line on how to play while it shows, under it in its upper slot and above it in its lower one: "+100" sat
   * behind "ARROWS RUN, SPACE JUMPS, X DASHES" and "hello, world" between the words of "JUMP, THEN X TO DASH". The line
   * on how to play is on the UI camera, which draws the view unscrolled. The view is read off the scroll: the world
   * view follows it only as the frame draws, and lines kept to it lagged a frame behind the HUD as the view moved down.
   * One object, reused: read it before the next call.
   */
  private measureRoom() {
    const cam = this.scene.cameras.main;
    const left = cam.scrollX + PAD_X; // `keepClear` uses this each frame with live lines
    const top = cam.scrollY + PAD_Y;
    const room = this.room;
    room.top = top + this.hudHeight();
    room.bottom = top + HEIGHT;
    room.hint = this.hint().popupBounds(left, top);
    return room;
  }

  keepClear(him: Phaser.Geom.Rectangle) {
    if (!this.lines.length) return;
    const room = this.measureRoom();
    // A line rises as it fades, kept in its room every frame: placed under the HUD, points rose behind it as the view
    // followed him down off the high route, and after the phone turned sideways, under the canvas HUD that turned on.
    // A line he moves into hides while he is in it: he bounced up through the points over his head.
    for (const line of this.lines) {
      line.y = Phaser.Math.Clamp(
        line.getData("y") - line.getData("rise") * (1 - line.alpha),
        lineLimit(room, line.x, line.displayWidth, true) + line.displayHeight,
        lineLimit(room, line.x, line.displayWidth, false),
      );
      line.setVisible(!Phaser.Geom.Intersects.RectangleToRectangle(him, line.getBounds(this.lineBox)));
    }
  }
}
