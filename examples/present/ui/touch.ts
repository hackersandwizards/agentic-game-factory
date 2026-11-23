import Phaser from "phaser";
import { HEIGHT, PORTRAIT, WIDTH } from "../design/tokens";
import type { Bands } from "./bands";

const keys = ["left", "right", "dash", "jump"] as const;
type Press = (key: (typeof keys)[number], down: boolean) => void;

export class Touch {
  padRoom = 0; // world px the sideways touch pad covers at the view's bottom, with 16 px to spare

  private readonly scene: Phaser.Scene;
  private readonly press: Press;
  private readonly bands: Bands;
  private buttons: Phaser.GameObjects.Image[][] = [];
  private readonly pad = document.getElementById("pad")!;
  private readonly ended: () => boolean;

  constructor(scene: Phaser.Scene, bands: Bands, press: Press, ended: () => boolean) {
    this.scene = scene;
    this.bands = bands;
    this.press = press;
    this.ended = ended;
  }

  get available() {
    return this.scene.sys.game.device.input.touch;
  }

  /** What the hints call the dash: the font has no glyph like the button's sparkle, so on touch its name. */
  get dashKey() {
    return this.available ? "DASH BUTTON" : "X";
  }

  add() {
    const ring = this.scene.textures.get("pad").source[0].width; // the touch buttons' texture, px across
    const buttons = (this.buttons = this.canvasButtons(ring));
    // Upright, the canvas is small and the band under it empty: there the same buttons are HTML (index.html),
    // up to 66 CSS px. Sideways on a phone, a screen under 540 CSS px tall, they are HTML too, 66 px, in
    // the lower corners as on a gamepad: < and > side by side on the left, the dash and the jump on the right. Stacked
    // in the 75 px bands beside the canvas of an 844x390 phone, the thumb had to reach up for the top one. They cover
    // the bottom 82 px of the corners, where the camera never shows him (the autopilot tests count it).
    const pad = this.pad;
    const arrows = keys.map((key) => (key === "dash" ? "dash" : `arrow-${key === "jump" ? "up" : key}`));
    keys.forEach((key, i) => {
      const button = pad.children[i] as HTMLButtonElement;
      button.style.backgroundImage = `url(${this.scene.textures.getBase64(arrows[i])}), url(${this.scene.textures.getBase64("pad")})`;
    });
    this.bindPointers(pad);
    // Each button is at least 44 CSS px across, the smallest comfortable touch target, also where a portrait
    // phone shows the canvas small; never smaller than its 99 px texture, where the centres sit at
    // x 72, 192, 768 and 888, y 474.
    const fit = () => {
      const sides = !PORTRAIT.matches && this.scene.scale.parentSize.height < HEIGHT;
      // Upright, four buttons between the 16 px gutters, 16 px or more apart within a pair and twice that between the
      // pairs (index.html): on a 320 px phone the 66 px buttons stood 7 to 9 px apart, and at 60 px all 16 px apart, so
      // the thumbs' pairs read as one row. 56 px there.
      const size = sides ? 66 : Math.floor(Math.min(66, (this.scene.scale.parentSize.width - 96) / 4));
      pad.classList.toggle("sides", sides);
      this.padRoom = sides ? (16 + size + 16) / (this.scene.scale.displaySize.width / WIDTH) : 0;
      pad.classList.toggle("small", size < 56);
      pad.style.setProperty("--size", `${size}px`);
      keys.forEach((_, i) => {
        const button = pad.children[i] as HTMLButtonElement;
        button.style.backgroundSize = `${(this.scene.textures.get(arrows[i]).source[0].width * size) / ring}px, ${size}px`;
      });
      const k = Math.max(1, 44 / (ring * (this.scene.scale.displaySize.width / WIDTH)));
      const r = (ring / 2) * k;
      const xs = [22.5 + r, 43.5 + 3 * r, WIDTH - 43.5 - 3 * r, WIDTH - 22.5 - r];
      buttons.forEach((parts, i) =>
        parts.forEach((part) =>
          part
            .setScale(k)
            .setPosition(xs[i], HEIGHT - 16.5 - r)
            .setVisible(!PORTRAIT.matches && !sides),
        ),
      );
      pad.hidden = !(PORTRAIT.matches || sides) || this.ended();
    };
    fit();
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, fit);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.scale.off(Phaser.Scale.Events.RESIZE, fit);
      pad.hidden = true;
    });
  }

  remove() {
    for (const parts of this.buttons)
      for (const part of parts) {
        this.scene.tweens.killTweensOf(part);
        part.destroy();
      }
    this.pad.hidden = true;
  }

  private canvasButtons(ring: number) {
    return (["left", "right", "dash", "up"] as const).map((label) => {
      // A stepped pixel ring with a 40 % see-through fill; the baked arrow (a star for the dash) stays readable.
      const circle = this.scene.add.image(0, 0, "pad");
      const arrow = this.scene.add.image(0, 0, label === "dash" ? "dash" : `arrow-${label}`);
      for (const part of [circle, arrow]) this.bands.ui(part).setDepth(35).setName("controls");
      const key = label === "up" ? "jump" : label;
      circle.setInteractive(
        new Phaser.Geom.Circle(ring / 2, ring / 2, ring / 2),
        (circle: Phaser.Geom.Circle, x: number, y: number) => circle.contains(x, y),
      );
      circle.on("pointerdown", () => this.press(key, true));
      circle.on("pointerup", () => this.press(key, false));
      circle.on("pointerout", () => this.press(key, false));
      return [circle, arrow];
    });
  }

  private bindPointers(pad: HTMLElement) {
    // A touch stays captured by the button it went down on, so a thumb sliding from > to < ran right until it lifted.
    // Each pointer holds the button under it instead: sliding onto another switches, sliding off lets go. Two thumbs
    // are two pointers, so running and jumping together still hold both.
    const held = new Map<number, (typeof keys)[number]>();
    const hold = (event: PointerEvent) => {
      const under = document.elementFromPoint(event.clientX, event.clientY);
      const key = event.buttons ? keys[[...pad.children].indexOf(under!)] : undefined;
      const was = held.get(event.pointerId);
      if (key === was) return;
      if (key) held.set(event.pointerId, key);
      else held.delete(event.pointerId);
      if (was && ![...held.values()].includes(was)) this.press(was, false);
      if (key) this.press(key, true);
    };
    pad.onpointerdown = pad.onpointermove = pad.onpointerup = pad.onpointercancel = hold;
  }
}
