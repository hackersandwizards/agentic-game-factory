import Phaser from "phaser";
import { bake } from "../design/art";
import { listenForKonami } from "../ui/konami";
import { TILE } from "../domain/terrain";
import { onKey } from "../systems/keys";
import { buildDoor, makeDoorFlight } from "./title/door";
import { addPlaques, blinkPlaque } from "./title/plaques";
import { addStrip, addSwitches } from "./title/strip";
import { addBeltLights, addWindowSnow, showWorkshop, WORKSHOP_WIDTH } from "./title/workshop";
import atlas from "../assets/atlas.webp";
import atlasData from "../assets/atlas.json";
import foreground from "../assets/foreground.webp";
import forest from "../assets/forest.webp";
import mountains from "../assets/mountains.webp";
import near from "../assets/near.webp";
import sky from "../assets/sky.webp";
import tiles from "../assets/tiles.webp";
import valley from "../assets/valley.webp";
import workshop from "../assets/workshop.webp";

// The game opens where h&w's Christmas video ends: in the elves' workshop, at the door to Level 2027.
export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  preload() {
    for (const [key, url] of Object.entries({
      foreground,
      forest,
      mountains,
      near,
      sky,
      valley,
      workshop,
    }))
      this.load.image(key, url);
    this.load.spritesheet("tiles", tiles, { frameWidth: TILE, frameHeight: TILE });
    this.load.atlas("atlas", atlas, atlasData);
  }

  create() {
    bake(this);
    showWorkshop(this);
    const hint = addPlaques(this);
    addBeltLights(this);
    const textRight = addStrip(this);
    const switches = addSwitches(this, textRight);
    const blink = blinkPlaque(this, hint);
    addWindowSnow(this);
    const door = buildDoor(this);
    const start = makeDoorFlight(this, door, hint, blink, switches);
    this.listenForStart(start, switches);
    listenForKonami(this, WORKSHOP_WIDTH);
  }

  private listenForStart(
    start: () => void,
    { switches, upright, mute, flip }: ReturnType<typeof addSwitches>,
  ) {
    // A switch focused with Tab takes Enter and Space itself: the key flips it and starts nothing. Phaser hands
    // on keys in its next step, after the click has let go of the focus, so the key's own target decides.
    const startByKey = (event: KeyboardEvent) => {
      if (!switches.contains(event.target as Node)) start();
    };
    onKey(this, "keydown-SPACE", startByKey);
    onKey(this, "keydown-ENTER", startByKey);
    this.input.on("pointerdown", start);
    // Upright the canvas is a strip across the middle, and a tap in the bands above and below it started nothing:
    // there a tap anywhere on the page starts, but on the HTML switches. The canvas's own taps stay Phaser's, where
    // a switch icon stops them.
    const startByTap = (event: PointerEvent) => {
      const target = event.target as Node;
      if (upright.matches && target !== this.game.canvas && !switches.contains(target)) start();
    };
    document.addEventListener("pointerdown", startByTap);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      document.removeEventListener("pointerdown", startByTap),
    );
    onKey(this, "keydown-M", mute);
    onKey(this, "keydown-G", flip);
  }
}
