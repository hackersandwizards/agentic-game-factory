# CLAUDE.md

This repo is a kit for building one small 2D game with Phaser 4, TypeScript and Vite, together with a
coding agent. Do not assume the person you work with can code or has used a terminal: explain each
command you ask them to run until they show they know it. The game is the occasion; the point is
practising agentic engineering: plan first, small steps, the agent checks its own work.
Answer in the language the person writes in.

The person's game is one folder, `examples/<game-name>/`: every file of it goes there, so its pull
request merges beside every other game. Without that folder, start with the `game-wizard` skill: it
finds the game with the person and creates it with `GAME.md`. With it, the `quest` skill builds the
game, one quest at a time. Among several games, the person's is the one whose `GAME.md` their Git
identity committed:
`git log --author="$(git config user.email)" --format= --name-only -- "examples/*/GAME.md"`.

## Commands

Bun 1.4.5 or newer is a prerequisite (README): install and add packages with `bun`, so `bun.lock` pins the versions.

- `bun run dev`: dev server. `http://localhost:5173/examples/<game-name>/` is the person's game,
  `/examples/present/` the example game, `/starter/` the starter, `/` the list of games.
- `bun run check`: installs from the lockfile, checks formatting, type-aware lint, styles, imports,
  TypeScript, links and dependency rules, runs every unit test, builds the game and plays it in the
  browser. Run it before every commit. What the commit and push hooks check, and every other check
  command: [Check commands](docs/checks.md).
- `bun run test`: runs the fast Vitest tests, `unit/` and each game's `*.test.ts`. Keep browser and game interactions in
  Playwright. Run mutation testing on demand through `bun run mutation`.
- `bun run format`: fixes formatting.
- `bun run build`: the shareable game in `dist/`.
- The `chrome-devtools` MCP server (`.mcp.json`, `.codex/config.toml`): a headless Chrome you play,
  screenshot and measure the game in. Without it, `bun .claude/skills/playtest/playtest.mjs <page>
<steps>` plays and saves screenshots. See the `playtest` skill.

The TypeScript gate runs the TypeScript 7 compiler from `@typescript/native`. The `typescript`
package points to `@typescript/typescript6` for tools that need the TypeScript 6 JavaScript API,
including typescript-eslint.

## Layout

- `starter/index.html` and `src/main.ts`: the starter, one scene with a square that moves.
- `examples/present/`: "Bring the present home", a title scene and one-level platformer. Copy its
  patterns into the person's game. The [architecture contract](docs/example-architecture.md) maps its layers
  and modules, along with the limits and import rules they follow.
- `brand.json`: the one copy of h&w's colours, from the brand package at the version it names; its
  `source` says why it is a copy. The example, the pages' CSS (`var(--night)`, injected by
  `vite.config.ts`) and `studio/` (through `studio/scripts/brand.mjs`) read them from there; the
  game's own pixel palette stays in its files.
- `examples/<game-name>/`: the person's game. `index.html` is its page and `main.ts` its entry.
  `GAME.md` holds the pitch, reference games, scope and quest plan, written by `game-wizard`; `quest`
  marks quests done. Its tests are `*.test.ts` (Vitest) and `*.spec.ts` (Playwright), its files from
  elsewhere are in `assets/` with a row each in its `CREDITS.md`, and its decisions are in its own
  `CLAUDE.md`.
- `tests/`: one spec per area; read the test titles.
- Tests read game state from `window.game`, which every game's entry sets. `tests/game.ts`
  holds what they share: opening the example, tapping, the autopilot.
- `studio/`: optional, its own `package.json`: the HyperFrames trailer, the greeting video and workshop picture tools.
  Its scripts are POSIX `sh`: macOS, Linux or Git Bash on Windows.
  Its greeting mode personalises the greeting for any team or group. Beispiel GmbH is the fictional
  sample: real data lives outside the repo and renders with `--customers <dir>`. See the `studio` skill. Never import from it.
- `.github/workflows/`: `pages.yml` builds, starts every page in Chrome and publishes `dist/` to GitHub
  Pages on every push to `main`; `check.yml` runs the push checks and the boot test on a pull
  request.
- Every `examples/*/index.html` is a page: built, shown on the root page as a tile, its `<title>` under its
  `cover.webp` (the `playtest` script's `--cover` saves one), started
  by `tests/boot.spec.ts` and published.

## How to work

The `quest` skill owns a quest's steps: plan and wait for the OK, the smallest playable slice,
playtest, review, check, commit. For every change, in a quest or not:

- Record a decision the next session needs (controls, tile size, level format) in the game's
  `CLAUDE.md`, in one line each.
- Before sharing, or after a quest that changed look or feel: the `game-review` skill has a fresh
  agent play and rate the game until the verdict is ship.

## Engineering principles

Load the `engineering` skill before changing code. Minimalism, on the ladder of
`.claude/rules/minimalism.md`:

- What the current quest does not need becomes a later quest in `GAME.md`. The dependency and
  platform rungs are Phaser first, then the browser and TypeScript.
- Keep single-use settings as constants near the code. The
  [architecture contract](docs/example-architecture.md#modules) describes when a game part needs a
  class.
- At a [code limit](docs/example-architecture.md#limits), split the file or function along a game concept without suppressing the lint rule.

Frame budget, 60 fps or 16.7 ms per frame:

- `update()` allocates nothing: no `new`, no object or array literals, no closures, no
  `map`/`filter`. Create vectors, arrays and objects in `create()` and reuse them.
- Draw shapes once: bake Graphics into a texture at boot (`bake` in `examples/present/design/art.ts`) and
  show sprites. Never redraw a Graphics object every frame.
- Particles, bullets and enemies come from a pool: one particle emitter, or a Group with `maxSize`
  and `get()`.
- Measure before optimising, with `tests/perf.spec.ts` (its header says what it measures and why);
  copy it into the person's game for its page. Change one thing, measure again, keep the change only when the
  number improved.

Correctness:

- One Playwright test in the game's folder per rule that matters (win, lose, score, a door that opens). It reads state the
  game exposes on `window`, as `tests/smoke.spec.ts` reads `window.game` in the example. Run a new
  test once against code that breaks the rule and see it fail: a test that never failed proves
  nothing.

Security, since the game is a public web page:

- No secrets in the repo: no API key, token or `.env` file. A static game needs none; a feature that
  does (online leaderboard, accounts) is out of v1.
- No `eval`, `new Function`, string `setTimeout` or `innerHTML` with data.
- Everything the game runs ships in `dist/`: no script, font or analytics loaded from another site
  at runtime. Install it as a package and bundle it, as the example does with its font.
- Dependencies stay pinned to exact versions: add one with `bun add --exact`,
  and only after the person agrees. Run `bun run check:advisories` to look up known vulnerabilities
  in the public package registry on demand.
- Share only `dist/` from `bun run build`. Data read back from `localStorage` is parsed in
  `try`/`catch` with a fresh start as the fallback.

## Rules and skills

`.claude/rules/phaser.md` (Phaser 4 against the Phaser 3 code models know) and
`.claude/rules/high-resolution.md` (canvas, textures, movement and grid at high resolution) load in
Claude Code by the path of the file you open. The other files in `.claude/rules/` bind every
change, and Claude Code loads them at the start: `git.md`, `collaboration.md`, `minimalism.md`,
`writing.md`, `untrusted-content.md`, `coupling.md`, `subagents.md` and `agent-feedback.md`. Any
other agent reads every rule before its first change.

Beside the game's skills (`game-wizard`, `quest`, `playtest`, `game-review`, `studio`),
`.claude/skills/` holds the working skills: `engineering` before changing code,
`architecture-principles` for a design review, `polish` for a quality pass over the repository,
`dependency-updates`, `delegation` and `parallel-session` for subagents and work that spans
sessions, and `agent-feedback` after a correction and before writing a skill or rule.

## Art and sound

- Pixel art: the example's canvas is 1920x1080, `Scale.FIT`, `smoothPixelArt: true`; its level
  camera draws a 960x540 art grid at zoom 2 (`systems/camera.ts`), a second camera the HUD on the
  same grid (`ui/bands.ts`), and the title its 320x180 grid at zoom 6 (`shell/title/workshop.ts`). Text and the code icons keep
  the 320x180 layout, 3 art pixels per font pixel.
- The example's art is generated and built into lossless WebP files next to the code (`examples/present/assets/`,
  made by the `studio` skill); small sprites are code, a grid of characters each, drawn to a texture
  at boot (`bake` in `examples/present/design/art.ts`). Sound is code (`examples/present/systems/sound.ts`).
- Assets are drawn in code, made by the person (or their child), or downloaded as below. Reference
  games give mechanics, never art, characters or names.
- To use an image or sound file in the person's game: put it in the game's `assets/`, import it and
  load it in `preload()` (`import player from "./assets/player.png"`,
  `this.load.image("player", player)`), and add a row to the game's `CREDITS.md` with name, author,
  licence and source URL. Download a file only after the person agrees, and only
  under CC0 or a licence the person accepted.
