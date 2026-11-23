import { isSolid, readMap } from "./map";
import type { Cell } from "./map";

export const TILE = 48;
// A plank's top lies this many px under its tile's.
export const PLANK_TOP = 4;

export class Terrain {
  readonly solidAt = this.corners(false);
  readonly ceilingAt = this.corners(true);
  readonly cells: Cell[][];

  private readonly fall: { gravity: number; maxFall: number };

  constructor(rows: readonly string[], fall: { gravity: number; maxFall: number }) {
    this.cells = readMap(rows);
    this.fall = fall;
  }

  // The left edge of the first gap in the ground. A level whose bottom row has none gets no dash line: at -48 it showed
  // at once and replaced the controls line.
  firstPit() {
    const gap = this.cells.at(-1)!.indexOf("air");
    return gap < 0 ? Infinity : gap * TILE;
  }

  /** Whether a point at y has fallen out of the map, a tile and a half below its bottom row: a pit's hit. */
  fellOut(y: number) {
    return y > (this.cells.length + 1.5) * TILE;
  }

  /**
   * Whether level tiles fill a rectangle, read straight from the map's cells: no physics query, nothing
   * allocated, and pickups never count. Planks carry you but are no ceiling. Tiles are larger than
   * anything that asks, so the four corners decide.
   */
  private corners(ceiling: boolean) {
    return (x: number, y: number, w: number, h: number) => {
      const right = x + w - 1;
      const bottom = y + h - 1;
      return (
        this.tile(x, y, ceiling) ||
        this.tile(right, y, ceiling) ||
        this.tile(x, bottom, ceiling) ||
        this.tile(right, bottom, ceiling)
      );
    };
  }
  private tile(x: number, y: number, ceiling: boolean) {
    return isSolid(this.cells[Math.floor(y / TILE)]?.[Math.floor(x / TILE)], ceiling);
  }
  /** The top of the first ground below y in column x, within four tiles; -1 over a pit or inside a wall. */
  groundBelow(x: number, y: number) {
    const col = Math.floor(x / TILE);
    const first = Math.floor(y / TILE);
    for (let row = first; row < first + 4; row++) {
      const cell = this.cells[row]?.[col];
      if (isSolid(cell)) return row === first ? -1 : row * TILE + (cell === "plank" ? PLANK_TOP : 0);
    }
    return -1;
  }

  /**
   * The top of the ground a fall from x, y at vx, vy comes down on, followed along its arc in physics steps for up to 2 s;
   * -1 into a pit. Looking straight down instead, the camera saw a jump's landing only once he was over it.
   */
  landing(x: number, y: number, vx: number, vy: number) {
    const dt = 1 / 60;
    for (let i = 0; i < 120 && y < this.cells.length * TILE; i++) {
      vy = Math.min(vy + this.fall.gravity * dt, this.fall.maxFall);
      x += vx * dt;
      y += vy * dt;
      const cell = this.cells[Math.floor(y / TILE)]?.[Math.floor(x / TILE)];
      if (vy > 0 && isSolid(cell)) return Math.floor(y / TILE) * TILE + (cell === "plank" ? PLANK_TOP : 0);
    }
    return -1;
  }
}
