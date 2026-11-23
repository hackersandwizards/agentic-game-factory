import Phaser from "phaser";
import { ATLAS } from "../design/art";
import type { Cells } from "../domain/map";
import { PLANK_TOP, TILE } from "../domain/terrain";

/** What he stands on, as the map draws it: snowy ground and stone, crates, plank bridges, a candy cane. */
export class Ground {
  readonly solids: Phaser.Physics.Arcade.StaticGroup;
  private planks: Phaser.GameObjects.Image[] = [];
  private readonly scene: Phaser.Scene;
  private readonly cells: Cells;

  constructor(scene: Phaser.Scene, cells: Cells) {
    this.scene = scene;
    this.cells = cells;
    this.solids = scene.physics.add.staticGroup();
  }

  add(kind: "ground" | "crate" | "plank", x: number, y: number, px: number, py: number) {
    // Tiles: the ground's snowy top row and the stone below, each with a left end, a middle and a
    // right end where the ground breaks off; plank bridges the same; crates.
    const row = this.cells[y];
    const end = row[x - 1] !== kind ? 0 : row[x + 1] !== kind ? 2 : 1;
    // Stone under stone has no top to land on: a wizard sliding down a pit wall would stand on the seam.
    if (kind === "ground") {
      const stone = this.cells[y - 1]?.[x] === "ground";
      const tile: unknown = this.solids.create(px, py, "tiles", (stone ? 3 : 0) + end);
      if (stone) {
        if (
          !(tile instanceof Phaser.Physics.Arcade.Sprite) ||
          !(tile.body instanceof Phaser.Physics.Arcade.StaticBody)
        ) {
          throw new Error("Expected a static Arcade sprite for a ground tile.");
        }
        tile.body.checkCollision.up = false;
      }
    }
    if (kind === "crate") this.solids.create(px, py, "tiles", 9);
    if (kind === "plank") {
      const plank = this.solids.create(px, py, "tiles", 6 + end) as Phaser.Physics.Arcade.Image;
      this.planks.push(plank);
      const body = plank.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(TILE, 18).setOffset(0, PLANK_TOP);
      body.checkCollision.down = body.checkCollision.left = body.checkCollision.right = false;
    }
  }

  addCane(px: number, bottom: number) {
    this.scene.add.image(px, bottom, "atlas", ATLAS.cane).setOrigin(0.5, 1);
  }

  setPlankDepth(bottom: number) {
    // A plank with its top above his feet draws in front of him, his glow and the present: he passes behind it, as
    // through a one-way plank. His box is his bottom 45 px but his frame 97 tall, so his hat was drawn over the low
    // planks he walked under; raised a tile, a low plank's top stands 140 px over the ground, past his highest jump
    // (117 px). One he stands on or is above draws behind him, his feet on its snow. A depth set queues a sort of the
    // whole scene, so only a change sets it.
    for (const plank of this.planks) {
      const depth = bottom > plank.y - TILE / 2 + PLANK_TOP ? 11.5 : 0;
      if (plank.depth !== depth) plank.setDepth(depth);
    }
  }
}
