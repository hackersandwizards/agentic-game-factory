import brand from "./brand.json" with { type: "json" };

export default {
  plugins: ["stylelint-value-no-unknown-custom-properties"],
  overrides: [{ files: ["**/*.html"], customSyntax: "postcss-html" }],
  rules: {
    "csstools/value-no-unknown-custom-properties": [
      true,
      {
        importFrom: [
          {
            customProperties: Object.fromEntries(
              Object.entries(brand.colors).map(([key, value]) => ["--" + key, value]),
            ),
          },
        ],
      },
    ],
    "color-no-invalid-hex": true,
    "declaration-block-no-duplicate-properties": true,
    "property-no-unknown": true,
  },
};
