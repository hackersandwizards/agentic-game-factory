import Phaser from "phaser";
import { thresholdAlpha } from "../../design/text";
import { COLOR, PORTRAIT, TEXT, TINT } from "../../design/tokens";
import { gore, toggleGore } from "../../systems/blood";
import { muted, toggleMute } from "../../systems/sound";
import { WORKSHOP_HEIGHT, WORKSHOP_WIDTH } from "./workshop";

export function addStrip(scene: Phaser.Scene) {
  // The game's name and how to start, on a solid strip so they always read.
  scene.add.rectangle(0, 154, 320, 26, TINT.outline).setOrigin(0);
  // The browser antialiases even this pixel font, which reads soft at 6 times. Each line is copied to its
  // own texture with every pixel fully on or off and sampled nearest, so it stays as crisp as in the video.
  let textRight = 0;
  for (const [y, text, color] of [
    [157, "BRING THE PRESENT HOME", COLOR.amber],
    // white, as the film's last frame draws its call here, so only the wording changes at the cut
    [169, scene.sys.game.device.input.touch ? "TAP TO START" : "ENTER OR TAP TO START", COLOR.snow],
  ] as const) {
    const key = `strip-${text}`;
    if (!scene.textures.exists(key)) {
      const source = scene.make.text({ text, style: { ...TEXT, color } }, false);
      const texture = scene.textures.createCanvas(key, source.canvas.width, source.canvas.height)!;
      const ctx = texture.getContext();
      ctx.drawImage(source.canvas, 0, 0);
      thresholdAlpha(ctx);
      texture.refresh().setFilter(Phaser.Textures.FilterMode.NEAREST);
      source.destroy();
    }
    textRight = Math.max(textRight, 160 + scene.add.image(160, y, key).setOrigin(0.5, 0).width / 2);
  }
  return textRight;
}

export function addSwitches(scene: Phaser.Scene, textRight: number) {
  // The speaker, as in the level's HUD: a tap on it mutes like M and starts nothing.
  // Upright, they are HTML buttons in the empty band under the canvas instead (index.html), 48 CSS px, each
  // texture pixel tripled, so they never sit small on the conveyor.
  const switches = document.getElementById("switches")!;
  const [chipButton, speakerButton] = [...switches.children] as HTMLButtonElement[];
  // A clicked button lets go of the keyboard focus, so the Enter that starts the game does not click it too.
  switches.onclick = (event) => (event.target as HTMLElement).blur();
  const [speaker, mute] = addSwitch(
    scene,
    speakerButton,
    "speaker",
    { x: 306, on: !muted, keys: ["speaker-off", "speaker"] },
    () => !toggleMute(),
  );
  // Beside it the 18+ switch, off until someone turns it on: a tap on it or G flips it and starts nothing.
  const [chip, flip] = addSwitch(
    scene,
    chipButton,
    "gore",
    { x: 291, on: gore, keys: ["chip-off", "chip-on"] },
    toggleGore,
  );
  // Each switch is a square of at least 44 CSS px to tap, 8 CSS px clear of the other, also where a small
  // window shows the canvas small; there both move left until their squares fit on the canvas, and where the
  // chip would then touch the strip's text, both icons move up into the picture above the strip.
  const place = () => {
    switches.hidden = !PORTRAIT.matches;
    for (const button of [speaker, chip]) button.setVisible(!PORTRAIT.matches);
    const px = scene.scale.displaySize.width / WORKSHOP_WIDTH;
    const [size, gap] = [Math.max(13, 44 / px), Math.max(2, 8 / px)];
    speaker.setX(Math.floor(Math.min(306, WORKSHOP_WIDTH - size / 2)));
    chip.setX(Math.floor(Math.min(291, speaker.x - size - gap)));
    const y = chip.x - chip.width / 2 >= textRight + 2 ? 167 : 151 - Math.ceil(speaker.height / 2);
    const top = Math.min(y - size / 2, WORKSHOP_HEIGHT - size);
    for (const button of [speaker, chip])
      (button.setY(y).input!.hitArea as Phaser.Geom.Rectangle).setTo(
        (button.width - size) / 2,
        top - y + button.height / 2,
        size,
        size,
      );
  };
  place();
  scene.scale.on(Phaser.Scale.Events.RESIZE, place);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, place);
    switches.hidden = true;
  });
  return { speaker, chip, mute, flip, switches, upright: PORTRAIT };
}

// A switch: its icon on the canvas and its HTML button, both showing keys[1] while on, keys[0] while off, and the
// button pressed while on, as the HUD's sound button is.
function addSwitch(
  scene: Phaser.Scene,
  button: HTMLButtonElement,
  name: string,
  start: { x: number; on: boolean; keys: [string, string] },
  change: () => boolean,
) {
  const { x, on, keys } = start;
  const icon = scene.add.image(x, 167, keys[+on]).setName(name);
  const show = (on: boolean) => {
    const key = keys[+on];
    icon.setTexture(key);
    button.ariaPressed = String(on);
    button.style.backgroundImage = `url(${scene.textures.getBase64(key)})`;
    button.style.backgroundSize = `${scene.textures.get(key).source[0].width * 3}px`;
  };
  const flip = () => show(change());
  show(on);
  button.onclick = flip;
  icon.setInteractive(new Phaser.Geom.Rectangle(), (rect: Phaser.Geom.Rectangle, x: number, y: number) =>
    rect.contains(x, y),
  );
  icon.on("pointerdown", (...args: [unknown, number, number, { stopPropagation(): void }]) => {
    args[3].stopPropagation();
    flip();
  });
  return [icon, flip] as const;
}
