const OUTSIDE_A_LAYER = "^examples/present/(?!(?:domain|design|systems|ui|entities|levels|shell)/).+\\.ts$";

module.exports = {
  forbidden: [
    { name: "runtime-cycle", severity: "error", from: {}, to: { circular: true } },
    {
      name: "stay-in-checkout",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["local"], path: "^\\.\\./" },
    },
    { name: "resolve-imports", severity: "error", from: {}, to: { couldNotResolve: true } },
    {
      name: "game-is-independent",
      severity: "error",
      from: { path: "^(src|examples)/", pathNot: "\\.(?:test|spec)\\.ts$" },
      to: { path: "^(tests|unit|studio|scripts)/" },
    },
    {
      name: "game-knows-only-itself",
      severity: "error",
      from: { path: "^examples/([^/]+)/" },
      to: { path: "^(?:src|examples)/", pathNot: "^examples/$1/" },
    },
    {
      name: "starter-is-independent",
      severity: "error",
      from: { path: "^src/" },
      to: { path: "^examples/" },
    },
    // The example's layers, lowest first: domain, design, systems, ui and entities side by side, levels, shell.
    // docs/example-architecture.md explains each. Every module lives in one of them.
    {
      name: "present-module-outside-a-layer",
      severity: "error",
      from: { path: OUTSIDE_A_LAYER },
      to: {},
    },
    {
      name: "present-import-from-outside-a-layer",
      severity: "error",
      from: {},
      to: { path: OUTSIDE_A_LAYER },
    },
    {
      name: "present-domain-is-pure",
      severity: "error",
      from: { path: "^examples/present/domain/" },
      to: { pathNot: "^examples/present/domain/" },
    },
    {
      name: "present-placement-is-pure",
      severity: "error",
      from: { path: "^examples/present/ui/placement\\.ts$" },
      to: {},
    },
    {
      name: "present-design-is-a-leaf",
      severity: "error",
      from: { path: "^examples/present/design/" },
      to: { path: "^examples/present/(?:domain|systems|ui|entities|levels|shell)/" },
    },
    {
      name: "present-systems-know-no-part",
      severity: "error",
      from: { path: "^examples/present/systems/" },
      to: { path: "^examples/present/(?:ui|entities|levels|shell)/" },
    },
    {
      name: "present-ui-knows-no-entity",
      severity: "error",
      from: { path: "^examples/present/ui/" },
      to: { path: "^examples/present/(?:entities|levels|shell)/" },
    },
    {
      name: "present-entities-know-no-ui",
      severity: "error",
      from: { path: "^examples/present/entities/" },
      to: { path: "^examples/present/(?:ui|levels|shell)/" },
    },
    {
      name: "present-levels-only-from-shell",
      severity: "error",
      from: { pathNot: "^examples/present/(?:levels|shell)/" },
      to: { path: "^examples/present/levels/" },
    },
    {
      name: "present-level-scene-knows-no-level",
      severity: "error",
      from: { path: "^examples/present/levels/[^/]+\\.ts$" },
      to: { path: "^examples/present/levels/[^/]+/" },
    },
    {
      name: "present-level-knows-only-itself",
      severity: "error",
      from: { path: "^examples/present/levels/([^/]+)/" },
      to: {
        path: "^examples/present/levels/",
        pathNot: "^examples/present/levels/(?:$1/|level\\.ts$)",
      },
    },
    {
      name: "present-shell-is-root",
      severity: "error",
      from: { pathNot: "^examples/present/shell/" },
      to: { path: "^examples/present/shell/" },
    },
    {
      name: "present-title-parts-only-from-title",
      severity: "error",
      from: { pathNot: "^examples/present/shell/title(?:\\.ts$|/)" },
      to: { path: "^examples/present/shell/title/" },
    },
    {
      name: "present-art-parts-only-from-art",
      severity: "error",
      from: { pathNot: "^examples/present/design/art(?:\\.ts$|/)" },
      to: { path: "^examples/present/design/art/" },
    },
    {
      name: "present-wizard-parts-only-from-wizard",
      severity: "error",
      from: { pathNot: "^examples/present/entities/wizard(?:\\.ts$|/)" },
      to: { path: "^examples/present/entities/wizard/" },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: "(^|/)node_modules/" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "node", "default"] },
  },
};
