// The files the compositions load that git does not hold, copied without a shell so that
// `bun run` does the same on Windows, whose script shell has no `for` and no `[ -nt ]`.
//   bun scripts/assets.mjs vendor   the packages' browser files into both assets/vendor/ folders
//   bun scripts/assets.mjs trailer  the example's clip and title, each when newer than its copy
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const at = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const VENDOR = [
  "gsap/dist/gsap.min.js",
  "@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2",
  "qrcode-generator/dist/qrcode.js",
];
const TRAILER = { "gameplay.mp4": "clip.mp4", "title.png": "title.png" };
const changed = (file) => statSync(file, { throwIfNoEntry: false })?.mtimeMs ?? -Infinity;

const mode = process.argv[2];
if (mode === "vendor") {
  for (const dir of ["trailer", "greeting"]) {
    mkdirSync(at(`${dir}/assets/vendor`), { recursive: true });
    for (const file of VENDOR)
      copyFileSync(at(`node_modules/${file}`), at(`${dir}/assets/vendor/${basename(file)}`));
  }
} else if (mode === "trailer") {
  mkdirSync(at("trailer/assets"), { recursive: true });
  for (const [from, to] of Object.entries(TRAILER)) {
    const [source, copy] = [at(`../docs/${from}`), at(`trailer/assets/${to}`)];
    if (changed(source) > changed(copy)) copyFileSync(source, copy);
  }
} else {
  console.error("usage: bun scripts/assets.mjs vendor|trailer");
  process.exit(2);
}
