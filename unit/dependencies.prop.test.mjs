import { fc, test } from "@fast-check/vitest";
import { expect } from "vitest";
import { checkLicenses, checkPins } from "../scripts/dependencies.mjs";
import { unicodeString } from "./property-setup";

const section = fc.constantFrom(
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "overrides",
);
const version = fc.tuple(fc.nat(), fc.nat(), fc.nat()).map((parts) => parts.join("."));
const exactPin = fc
  .tuple(version, fc.constantFrom("", "-beta.1", "-rc-1"))
  .map(([stable, prerelease]) => stable + prerelease);
const packageName = fc.constantFrom("public-package", "__proto__", "constructor", "toString");

/** @param {string} sectionName @param {string} name @param {unknown} pin */
function validatePin(sectionName, name, pin) {
  checkPins("package.json", JSON.stringify({ [sectionName]: { [name]: pin } }));
}

test.prop([section, exactPin, packageName], {
  examples: [
    ["dependencies", "0.0.0", "__proto__"],
    ["devDependencies", "14.22.31-beta.1", "constructor"],
    ["optionalDependencies", "4.2.1-rc-1", "toString"],
    ["peerDependencies", "4.2.1", "public-package"],
    ["overrides", "4.2.1", "public-package"],
  ],
})("accepts exact stable and prerelease pins in each checked section", (sectionName, exact, name) => {
  expect(() => validatePin(sectionName, name, exact)).not.toThrow();
});

/** @type {import("fast-check").Arbitrary<string | string[] | null>} */
const invalidPin = fc.oneof(
  unicodeString.map((text) => `^${text}`),
  version.map((exact) => [exact]),
  version.map((exact) => `~${exact}`),
);
test.prop([fc.array(fc.tuple(section, invalidPin, packageName), { minLength: 1 })], {
  examples: [
    [
      [
        ["dependencies", "", "public-package"],
        ["dependencies", "^4.2.1", "__proto__"],
        ["devDependencies", "^4.2.1", "constructor"],
        ["optionalDependencies", "^4.2.1", "toString"],
        ["peerDependencies", "^4.2.1", "public-package"],
        ["overrides", "^4.2.1", "public-package"],
        ["dependencies", "4.2.1 - 5.0.0", "public-package"],
        ["dependencies", "1.0.0-", "public-package"],
        ["dependencies", "1x0.0", "public-package"],
        ["dependencies", "1.0x0", "public-package"],
        ["dependencies", "1.0.0é", "public-package"],
        ["dependencies", "1.0.0-💡", "public-package"],
        ["dependencies", "1.0.0-foo/bar", "public-package"],
        ["dependencies", null, "public-package"],
      ],
    ],
  ],
})("rejects ranges and malformed pins even in otherwise recognized sections", (pins) => {
  for (const [sectionName, invalid, name] of pins) {
    expect(() => validatePin(sectionName, name, invalid)).toThrow(
      `use an exact public registry release for ${name}`,
    );
  }
});

const spdxLeaf = fc.boolean().map((allowed) => ({ text: allowed ? "MIT" : "AGPL-3.0-only", allowed }));
const spdxExpression = fc.letrec((tie) => ({
  expression: fc.oneof(
    { depthSize: "small", maxDepth: 4 },
    spdxLeaf,
    fc.tuple(tie("expression"), fc.boolean(), tie("expression")).map(([left, and, right]) => ({
      text: `(${left.text} ${and ? "AND" : "OR"} ${right.text})`,
      allowed: and ? left.allowed && right.allowed : left.allowed || right.allowed,
    })),
  ),
})).expression;

test.prop([spdxExpression], {
  examples: [
    [{ text: "MIT AND AGPL-3.0-only", allowed: false }],
    [{ text: "AGPL-3.0-only AND MIT", allowed: false }],
    [{ text: "MIT OR AGPL-3.0-only", allowed: true }],
    [{ text: "AGPL-3.0-only OR MIT", allowed: true }],
    [{ text: "MIT AND ISC", allowed: true }],
    [{ text: "MIT OR ISC", allowed: true }],
    [{ text: "AGPL-3.0-only OR GPL-3.0-only", allowed: false }],
    [{ text: "", allowed: false }],
    [{ text: "MIT WITH", allowed: false }],
    [{ text: "不明", allowed: false }],
  ],
})("applies SPDX AND and OR to the allowlist and rejects malformed expressions", ({ text, allowed }) => {
  const validate = () =>
    checkLicenses((_, args) =>
      args.includes("licenses")
        ? JSON.stringify({ listed: [{ name: "sample", license: text }] })
        : "Found 0 untrusted dependencies with scripts.",
    );
  if (allowed) expect(validate).not.toThrow();
  else expect(validate).toThrow(`Review these dependency licences: sample (${text})`);
});
