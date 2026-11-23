// Writes assets/vendor/brand.js for the trailer and the greeting from ../brand.json, the repo's one
// copy of h&w's colours: a classic script, since both load their scripts without modules. It sets
// BRAND for the scripts after it and each colour as a CSS variable (--night and so on) for the CSS.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (path) => fileURLToPath(new URL(path, import.meta.url));
const { colors } = JSON.parse(readFileSync(at("../../brand.json"), "utf8"));
const js = `const BRAND = ${JSON.stringify(colors)};
for (const [k, v] of Object.entries(BRAND)) document.documentElement.style.setProperty("--" + k, v);
`;
for (const dir of ["trailer", "greeting"]) {
  mkdirSync(at(`../${dir}/assets/vendor`), { recursive: true });
  writeFileSync(at(`../${dir}/assets/vendor/brand.js`), js);
}
