import tseslint from "typescript-eslint";

const testCall =
  ":matches([callee.name=/^(test|it|describe)$/], [callee.object.name=/^(test|it|describe)$/], [callee.callee.object.name=/^(test|it|describe)$/], [callee.tag.object.name=/^(test|it|describe)$/])";

const testSyntax = [
  {
    selector: `CallExpression${testCall} > :matches(ArrowFunctionExpression, FunctionExpression)[body.body.length=0]`,
    message: "Write the assertion or remove the empty test.",
  },
  {
    selector: "MemberExpression[object.callee.name='expect'][property.name=/^(rejects|resolves)$/]",
    message: "Await the operation before asserting its result or caught error.",
  },
];

const propertyFactory = "CallExpression[callee.object.name='test'][callee.property.name='prop']";

export default [
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    rules: {
      "no-dupe-args": "error",
      "no-octal": "error",
      "no-useless-assignment": "error",
    },
  },
  {
    // Oxlint's no-restricted-globals stops Phaser as a value. As a type the namespace needs no import, so this stops it.
    files: ["examples/present/domain/**/*.ts", "examples/present/ui/placement.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSQualifiedName > Identifier.left[name='Phaser']",
          message: "Keep Phaser out of the rules: take a plain shape instead.",
        },
      ],
    },
  },
  {
    files: ["**/*.{test,spec}.{js,mjs,ts}", "tests/**/*.{ts,js}", "unit/**/*.{ts,mjs}"],
    rules: { "no-restricted-syntax": ["error", ...testSyntax] },
  },
  {
    files: ["{unit,examples}/**/!(*.prop).test.{ts,mjs}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...testSyntax,
        {
          selector: "ImportDeclaration[source.value=/^(@fast-check\\/vitest|fast-check)$/]",
          message: "Put properties in *.prop.test.* files so exploration can run them.",
        },
      ],
    },
  },
  {
    files: ["{unit,examples}/**/*.prop.test.{ts,mjs}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...testSyntax,
        {
          selector:
            "ImportDeclaration[source.value='vitest'] :matches(ImportNamespaceSpecifier, ImportSpecifier[imported.name=/^(test|it|describe)$/])",
          message: "Keep ordinary tests in ordinary test files.",
        },
        {
          selector:
            "ImportDeclaration[source.value='@fast-check/vitest'] :matches(ImportNamespaceSpecifier, ImportSpecifier[imported.name='it'], ImportSpecifier[imported.name='test'][local.name!='test'])",
          message: "Import test by name from @fast-check/vitest.",
        },
        {
          selector:
            ":matches(CallExpression[callee.name='test'], MemberExpression:matches([object.name='test'][property.name!='prop'], [object.name='fc'][property.name='assert']))",
          message: "Write properties as test.prop([...])(name, fn).",
        },
        {
          selector: `:matches(${propertyFactory}[arguments.length>2], ${propertyFactory} > SpreadElement, ${propertyFactory} > :nth-child(2):not(ObjectExpression), ${propertyFactory} > ObjectExpression > :matches(SpreadElement, Property[computed=true], Property[key.name=/^(seed|numRuns)$/], Property[key.value=/^(seed|numRuns)$/]))`,
          message: "Use inline property options and the shared seed and case count.",
        },
        {
          selector:
            "CallExpression[callee.callee.object.name='test'][callee.callee.property.name='prop'] > :matches(ArrowFunctionExpression, FunctionExpression):not(:has(CallExpression > MemberExpression.callee:has(CallExpression[callee.name='expect'])))",
          message: "Assert the rule inside the property callback.",
        },
      ],
    },
  },
];
