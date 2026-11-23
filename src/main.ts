import Phaser from "phaser";

// The empty starting game: one scene, one square you move with the arrow keys.
// Build your own game from here, one small step at a time (see GAME.md once /game-wizard wrote it).

const WIDTH = 320;
const HEIGHT = 180;
const SPEED = 120;

class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  create() {
    this.player = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 12, 12, 0xf59e0b);
    this.physics.add.existing(this.player);
    this.body().setCollideWorldBounds(true);
    this.cursors = this.input.keyboard!.createCursorKeys();
  }

  update() {
    const x = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
    const y = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
    this.body().setVelocity(x * SPEED, y * SPEED);
  }

  private body() {
    return this.player.body as Phaser.Physics.Arcade.Body;
  }
}

// Pixel art: the small canvas is scaled by the largest whole number that fits the window.
const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  pixelArt: true,
  backgroundColor: "#0b1118",
  scale: { mode: Phaser.Scale.NONE, zoom: Phaser.Scale.MAX_ZOOM, autoCenter: Phaser.Scale.CENTER_BOTH },
  // Fixed 60 Hz step: interpolate drawing (examples/present/entities/wizard.ts and wizard/drawing.ts) or it judders at 120/144/59.94 Hz.
  physics: { default: "arcade" },
  scene: GameScene,
});
addEventListener("resize", () => game.scale.setMaxZoom());
// On window so your tests can read game state, as the example's tests read it there.
Object.assign(window, { game });
