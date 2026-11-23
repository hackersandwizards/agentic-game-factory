import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { output } from "./process.mjs";

const require = createRequire(import.meta.url);

const allowed = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "CC0-1.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "ISC",
  "MIT",
  "MIT-0",
  "MPL-2.0",
  "OFL-1.1",
  "PSF-2.0",
  "Python-2.0",
  "Unlicense",
  "Zlib",
]);

/**
 * Packages the optional studio installs under a licence outside the list, each accepted by name.
 * The game's own dependencies get no exception.
 */
const studioExceptions = [
  // GSAP's Standard "no charge" licence (https://gsap.com/community/standard-license/) has no SPDX
  // identifier. It allows commercial use and bars only tools that let people build animations
  // without code. The studio animates from code, and its copy of GSAP goes to a git-ignored folder
  // at install: the kit ships none of it.
  /^gsap$/,
  // libvips, LGPL-3.0-or-later: the prebuilt binary sharp loads, which hyperframes brings in. It is
  // installed, never committed or shipped. It is its own package per platform on macOS and Linux
  // and part of sharp's platform package on Windows and WebAssembly.
  /^@img\/sharp-(?:libvips-[a-z0-9]+-[a-z0-9]+|win32-[a-z0-9]+|(?:[a-z]+-)?wasm32)$/,
];

const exactVersion = /^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){2}(?:-([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?$/;
const registryAlias = /^npm:((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)@(.+)$/;

/** @param {unknown} version */
function isExactVersion(version) {
  const match = typeof version === "string" ? exactVersion.exec(version) : null;
  return match !== null && !match[1]?.split(".").some((identifier) => /^0\d+$/.test(identifier));
}

/** @param {ReturnType<typeof import("spdx-expression-parse").default>} expression @returns {boolean} */
function permitted(expression) {
  if ("license" in expression) return allowed.has(expression.license);
  if (expression.conjunction === "and") return permitted(expression.left) && permitted(expression.right);
  return permitted(expression.left) || permitted(expression.right);
}

/** @param {string} manifest */
export function checkPins(manifest, contents = readFileSync(manifest, "utf8")) {
  const {
    dependencies,
    devDependencies,
    optionalDependencies,
    peerDependencies,
    overrides,
    resolutions,
    trustedDependencies,
  } = JSON.parse(contents);
  if (resolutions || trustedDependencies?.length) {
    throw new Error(
      `${manifest}: use exact overrides for affected dependencies and keep dependency lifecycle scripts untrusted.`,
    );
  }
  const pins = [dependencies, devDependencies, optionalDependencies, peerDependencies, overrides].flatMap(
    (section) => Object.entries(section ?? {}),
  );
  for (const [name, version] of pins) {
    const [, target, release] = typeof version === "string" ? (registryAlias.exec(version) ?? []) : [];
    if (
      name.startsWith("@hackersandwizards/") ||
      target?.startsWith("@hackersandwizards/") ||
      !isExactVersion(release ?? version)
    ) {
      throw new Error(`${manifest}: use an exact public registry release for ${name}.`);
    }
  }
}

export function checkLicenses(readBun = output) {
  const parse = /** @type {typeof import("spdx-expression-parse").default} */ (
    require("spdx-expression-parse")
  );
  for (const [cwd, exceptions] of /** @type {[string, RegExp[]][]} */ ([
    [".", []],
    ["studio", studioExceptions],
  ])) {
    const where = cwd === "." ? "" : ` in ${cwd}`;
    // The gate installs only the game: a fresh clone has no studio packages to read.
    if (where) readBun("bun", ["install", "--frozen-lockfile", "--ignore-scripts"], { cwd });
    /** @type {Record<string, {name: string, license: string}[]>} */
    const byLicense = JSON.parse(readBun("bun", ["pm", "licenses", "--json"], { cwd }));
    const packages = Object.values(byLicense).flat();
    if (packages.length === 0) throw new Error(`Bun listed no licences${where}. Run bun install.`);
    const rejected = [];
    for (const { name, license } of packages) {
      if (exceptions.some((exception) => exception.test(name))) continue;
      try {
        if (permitted(parse(license))) continue;
      } catch {
        // A missing or invalid SPDX expression also needs investigation.
      }
      rejected.push(`${name} (${license})`);
    }
    if (rejected.length) {
      throw new Error(`Review these dependency licences${where}: ${rejected.join(", ")}`);
    }

    const untrusted = readBun("bun", ["pm", "untrusted"], { cwd });
    if (!untrusted.includes("Found 0 untrusted dependencies with scripts.")) {
      throw new Error(`Review dependency install scripts${where}:\n${untrusted}`);
    }
  }
}
