import { expect, test } from "vitest";
import { checkLicenses, checkPins } from "../scripts/dependencies.mjs";

test("checks a dependency pin even when another manifest section repeats the name", () => {
  const manifest = {
    dependencies: { phaser: "^4.2.1" },
    devDependencies: { phaser: "4.2.1" },
  };
  expect(() => checkPins("package.json", JSON.stringify(manifest))).toThrow(
    "use an exact public registry release for phaser",
  );
});

test("rejects private packages even with an exact version", () => {
  const manifest = { dependencies: { "@hackersandwizards/brand": "1.0.0" } };
  expect(() => checkPins("package.json", JSON.stringify(manifest))).toThrow(
    "use an exact public registry release for @hackersandwizards/brand",
  );
});

test("accepts aliases to exact public registry versions", () => {
  const manifest = { devDependencies: { typescript: "npm:@typescript/typescript6@6.0.2" } };
  expect(() => checkPins("package.json", JSON.stringify(manifest))).not.toThrow();
});

test.each(["npm:typescript@^7.0.2", "npm:typescript@latest", "npm:@hackersandwizards/brand@1.0.0"])(
  "rejects a range, tag or private target in an alias: %s",
  (pin) => {
    const manifest = { devDependencies: { compiler: pin } };
    expect(() => checkPins("package.json", JSON.stringify(manifest))).toThrow(
      "use an exact public registry release for compiler",
    );
  },
);

test.each([{ resolutions: { phaser: "4.2.1" } }, { trustedDependencies: ["phaser"] }])(
  "rejects disallowed manifest settings %j",
  (manifest) => {
    expect(() => checkPins("package.json", JSON.stringify(manifest))).toThrow(
      "use exact overrides for affected dependencies and keep dependency lifecycle scripts untrusted",
    );
  },
);

test("allows packages under each approved licence", () => {
  const licenses = [
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
  ];
  const installed = Object.fromEntries(licenses.map((license) => [license, [{ name: license, license }]]));
  expect(() =>
    checkLicenses((_, args) =>
      args.includes("licenses") ? JSON.stringify(installed) : "Found 0 untrusted dependencies with scripts.",
    ),
  ).not.toThrow();
});

test.each(["0.0.0", "npm:public-package@0.0.0"])("rejects a manifest pin stored as an array: %s", (pin) => {
  const manifest = { dependencies: { "public-package": [pin] } };
  expect(() => checkPins("package.json", JSON.stringify(manifest))).toThrow(
    "use an exact public registry release for public-package",
  );
});

test.each(["01.2.3", "1.02.3", "1.2.03", "1.0.0-beta_1", "1.0.0-beta..1", "1.0.0-01", "1.0.0-beta.001"])(
  "rejects the malformed version %s",
  (pin) => {
    const manifest = JSON.stringify({ dependencies: { "public-package": pin } });
    expect(() => checkPins("package.json", manifest)).toThrow(
      "use an exact public registry release for public-package",
    );
  },
);

test.each(["1.0.0-101", "1.0.0-01a", "1.0.0-beta.preview"])("accepts the valid version %s", (pin) => {
  const manifest = JSON.stringify({ dependencies: { "public-package": pin } });
  expect(() => checkPins("package.json", manifest)).not.toThrow();
});

test("fails closed when Bun reports no packages", () => {
  expect(() => checkLicenses(() => "{}")).toThrow("Bun listed no licences. Run bun install.");
});

test("lists every rejected package in a single diagnostic", () => {
  const installed = {
    denied: [
      { name: "one", license: "GPL-3.0-only" },
      { name: "two", license: "AGPL-3.0-only" },
    ],
  };
  expect(() => checkLicenses(() => JSON.stringify(installed))).toThrow(
    "Review these dependency licences: one (GPL-3.0-only), two (AGPL-3.0-only)",
  );
});

test("looks up installed licences and rejects untrusted dependency scripts reported by Bun", () => {
  const untrusted = "sample@1.0.0 has a postinstall script";
  /** @type {string[][]} */
  const calls = [];
  expect(() =>
    checkLicenses((command, args) => {
      calls.push([command, ...args]);
      return args.includes("licenses") ? '{"MIT":[{"name":"sample","license":"MIT"}]}' : untrusted;
    }),
  ).toThrow(`Review dependency install scripts:\n${untrusted}`);
  expect(calls).toEqual([
    ["bun", "pm", "licenses", "--json"],
    ["bun", "pm", "untrusted"],
  ]);
});

const gsapLicence = "Standard 'no charge' license: https://gsap.com/standard-license.";

/** @param {{name: string, license: string}[]} studio @returns {typeof import("../scripts/process.mjs").output} */
function installed(studio, root = [{ name: "sample", license: "MIT" }]) {
  return (_, args, options) => {
    if (args.includes("untrusted")) return "Found 0 untrusted dependencies with scripts.";
    return JSON.stringify({ listed: options?.cwd === "studio" ? studio : root });
  };
}

test.each([
  "@img/sharp-libvips-darwin-arm64",
  "@img/sharp-libvips-linux-x64",
  "@img/sharp-libvips-linuxmusl-arm64",
  "@img/sharp-win32-x64",
  "@img/sharp-wasm32",
  "@img/sharp-freebsd-wasm32",
])("accepts libvips in the studio on every platform: %s", (name) => {
  const studio = [
    { name: "gsap", license: gsapLicence },
    { name, license: "Apache-2.0 AND LGPL-3.0-or-later" },
  ];
  expect(() => checkLicenses(installed(studio))).not.toThrow();
});

test.each([
  ["another-animation", gsapLicence],
  ["gsap-trial", gsapLicence],
  ["libvips", "LGPL-3.0-or-later"],
  ["@img/sharp-libvips", "LGPL-3.0-or-later"],
  ["@other/sharp-libvips-linux-x64", "LGPL-3.0-or-later"],
  ["@img/sharp-linux-x64", "LGPL-3.0-or-later"],
  ["x@img/sharp-win32-x64", "LGPL-3.0-or-later"],
  ["@img/sharp-wasm32-extra", "LGPL-3.0-or-later"],
])("rejects %s in the studio under a licence its named exceptions carry", (name, license) => {
  expect(() => checkLicenses(installed([{ name, license }]))).toThrow(
    `Review these dependency licences in studio: ${name} (${license})`,
  );
});

test.each([
  ["gsap", gsapLicence],
  ["@img/sharp-libvips-darwin-arm64", "LGPL-3.0-or-later"],
])("keeps the studio's exception for %s out of the game's own dependencies", (name, license) => {
  expect(() => checkLicenses(installed([{ name: "sample", license: "MIT" }], [{ name, license }]))).toThrow(
    `Review these dependency licences: ${name} (${license})`,
  );
});

test("fails closed when Bun reports no packages in the studio", () => {
  expect(() => checkLicenses(installed([]))).toThrow("Bun listed no licences in studio. Run bun install.");
});

test("rejects untrusted dependency scripts in the studio", () => {
  expect(() =>
    checkLicenses((_, args, options) => {
      if (args.includes("licenses")) return '{"MIT":[{"name":"sample","license":"MIT"}]}';
      return options?.cwd === "studio"
        ? "sharp has an install script"
        : "Found 0 untrusted dependencies with scripts.";
    }),
  ).toThrow("Review dependency install scripts in studio:\nsharp has an install script");
});

test("installs the studio from its lockfile, without scripts, before it reads the licences there", () => {
  /** @type {unknown[][]} */
  const calls = [];
  checkLicenses((command, args, options) => {
    calls.push([options?.cwd, command, ...args]);
    return installed([{ name: "sample", license: "MIT" }])(command, args, options);
  });
  expect(calls).toEqual([
    [".", "bun", "pm", "licenses", "--json"],
    [".", "bun", "pm", "untrusted"],
    ["studio", "bun", "install", "--frozen-lockfile", "--ignore-scripts"],
    ["studio", "bun", "pm", "licenses", "--json"],
    ["studio", "bun", "pm", "untrusted"],
  ]);
});

test("reads the package manifest from disk if contents are omitted", () => {
  expect(() => checkPins("package.json")).not.toThrow();
});
