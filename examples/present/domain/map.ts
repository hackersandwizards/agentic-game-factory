// The map text's characters, one per 48 px tile, and what each stands for.
const LEGEND = {
  ".": "air",
  "#": "ground",
  "=": "plank", // a platform he can jump through from below
  c: "crate",
  o: "crystal",
  "*": "secret", // the secret crystal
  v: "heart", // refills one life
  d: "die", // the d20, an easter egg
  b: "bug",
  f: "fast", // a fast bug
  h: "hop", // a hopping bug
  T: "tree", // a Christmas tree: a checkpoint
  D: "door", // where he starts
  L: "goal",
  j: "cane",
  t: "terminal", // from here on: more easter eggs
  g: "ghost",
  "4": "sign",
  n: "neon",
} as const;

export type Cell = (typeof LEGEND)[keyof typeof LEGEND];
export type Cells = readonly (readonly Cell[])[];

/** The map text as cells. A character the legend lacks is an error: read as air, a typo silently left a hole. */
export function readMap(rows: readonly string[]): Cell[][] {
  return rows.map((row, y) =>
    Array.from(row, (char, x) => {
      if (!Object.hasOwn(LEGEND, char))
        throw new Error(`Map row ${y + 1}, column ${x + 1}: "${char}" is no map character.`);
      return LEGEND[char as keyof typeof LEGEND];
    }),
  );
}

/** Throws unless a level can be played on the map: rows of one length, a door to start at and a goal to reach. */
export function checkMap(cells: Cells) {
  const ragged = cells.findIndex((row) => row.length !== cells[0].length);
  if (ragged !== -1)
    throw new Error(
      `Map row ${ragged + 1} is ${cells[ragged].length} characters long, row 1 is ${cells[0].length}.`,
    );
  for (const [cell, char] of [
    ["door", "D"],
    ["goal", "L"],
  ] as const)
    if (!cells.some((row) => row.includes(cell))) throw new Error(`The map has no ${cell} (${char}).`);
}

/** Ground and crates stop him from every side. A plank carries him and is no ceiling. */
export function isSolid(cell: Cell | undefined, ceiling = false) {
  return cell === "ground" || cell === "crate" || (!ceiling && cell === "plank");
}
