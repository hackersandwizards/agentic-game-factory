import type { Level } from "../level";
import { Backdrop } from "./backdrop";
import MAP from "./map.txt?raw";

// The night forest between the workshop's door and the laptop. Edit map.txt and play.
export const NIGHT_FOREST: Level = {
  key: "level",
  map: MAP.trimEnd().split("\n"),
  backdrop: (scene) => new Backdrop(scene),
};
