import type Phaser from "phaser";

/**
 * A level's own scenery, around the play plane the level scene builds: added in three passes so it stacks behind,
 * among and in front of the level's objects, then moved every frame.
 */
export type LevelBackdrop = {
  /** Behind everything the map text places. */
  addFar(): void;
  /** Over the wizard and the bugs, under the foreground. */
  addMiddle(): void;
  /** In front of the play plane, under the night's light. */
  addNear(): void;
  /** Moves its own clock on by `dt` s, skipped while a hit-stop holds the world. */
  advance(dt: number): void;
  /** Called every frame with how far the view has climbed above the level's floor and its left edge, in px. */
  draw(climb: number, left: number): void;
  /** Something brushed past at a world point. */
  brush(x: number, y: number): void;
};

/**
 * A level, as the level scene needs it: the key its scene starts under, its map text (the characters: domain/map.ts)
 * and its backdrop.
 */
export type Level = {
  key: string;
  map: readonly string[];
  backdrop: (scene: Phaser.Scene) => LevelBackdrop;
};
