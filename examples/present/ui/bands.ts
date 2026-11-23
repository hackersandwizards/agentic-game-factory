import Phaser from "phaser";
import { crisp } from "../design/text";
import { COLOR, HEIGHT, HW, PORTRAIT, WIDTH, ZOOM } from "../design/tokens";

// The canvas gives each pair two rows. The HTML band reflows each joined pair.
export const INVITE = [
  {
    lines: ["YOUR TURN: OPEN CLAUDE CODE", "OR CODEX, TYPE /game-wizard"],
    separator: " ",
    color: COLOR.amber,
  },
  { lines: ["github.com/hackersandwizards/", "agentic-game-factory"], separator: "", color: HW.ampersand },
];
export const INVITE_BAND = INVITE.map(({ lines, separator, color }): [string, string][] => [
  [lines.join(separator), color],
]);

export class Bands {
  upright = false; // portrait: the canvas's text goes to the HTML bands as well (see words)
  private banded: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible)[] = []; // see band

  private readonly scene: Phaser.Scene;
  private readonly uiCam: Phaser.Cameras.Scene2D.Camera;
  private readonly worldOnly: (obj: Phaser.GameObjects.GameObject) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // A second camera draws the HUD and the panels on a fixed 960x540 grid, so the world camera's scroll,
    // shake and flash never move them. Every object starts on the world camera only; ui() moves one over.
    const uiCam = (this.uiCam = this.scene.cameras
      .add(0, 0, this.scene.scale.width, this.scene.scale.height)
      .setZoom(ZOOM));
    uiCam.centerOn(WIDTH / 2, HEIGHT / 2);
    // Every text in the level, HUD, popups, panels and eggs included, is drawn 1-bit (see crisp).
    this.worldOnly = (obj: Phaser.GameObjects.GameObject) => {
      uiCam.ignore(obj);
      if (obj instanceof Phaser.GameObjects.Text) crisp(obj);
    };
    this.scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.worldOnly);
  }

  watchOrientation() {
    // Turned mid-run, the canvas's lines show again sideways, where CSS hides the bands, and hide upright.
    const turn = () => {
      this.upright = PORTRAIT.matches;
      for (const obj of this.banded) if (obj.active) obj.setVisible(!this.upright);
    };
    turn();
    PORTRAIT.addEventListener("change", turn);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => PORTRAIT.removeEventListener("change", turn));
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.worldOnly);
    this.scene.cameras.remove(this.uiCam);
  }

  /**
   * Upright, the canvas is as narrow as the phone and its text about 8 CSS px tall, so the lines also go to
   * an HTML band above or below it (index.html), where they read at 12 px. Each line is coloured parts.
   */
  words(band: "above" | "below", lines: [string, string][][]) {
    const element = document.getElementById(band)!;
    element.replaceChildren(
      ...lines.map((parts) => {
        const line = document.createElement("div");
        for (const [text, color] of parts) {
          const span = line.appendChild(document.createElement("span"));
          span.style.color = color;
          // A URL wraps after a "/" inside it (or a "-", which the browser offers itself), never mid-word.
          text.split(/(?<=[a-z]\/)(?=[a-z])/).forEach((piece, i) => {
            if (i) span.append(document.createElement("wbr"));
            span.append(piece);
          });
        }
        return line;
      }),
    );
    element.hidden = !lines.length;
  }

  /** A screen-fixed object whose text the HTML bands show upright: drawn on the canvas only sideways. */
  band<T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible>(obj: T): T {
    this.banded.push(obj);
    return this.ui(obj).setVisible(!this.upright);
  }

  /**
   * Puts a screen-fixed object on the UI camera: the 960x540 grid, never scrolling, never shaken. Every
   * object starts on the world camera only (the display-list handler `worldOnly`), so this moves it, children included.
   */
  ui<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    obj.cameraFilter = this.scene.cameras.main.id;
    if (obj instanceof Phaser.GameObjects.Container) for (const child of obj.list) this.ui(child);
    return obj;
  }
}
