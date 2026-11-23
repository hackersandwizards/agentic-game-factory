# Checking the game

Start with `bun install` in the game's folder. It installs the versions in the lockfile and tells
Git to use this folder's hooks. The public package registry and Chrome for Testing are enough to run
the checks. The first browser run downloads Chrome for Testing if it is missing.

Run `bun run check` before a commit. It formats nothing. Its fast checks run side by side and it
names every one that failed; the build and the browser tests start only when all of them passed.

| Command                           | What it does                                                                                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check`                   | Checks the lockfile, formatting, lint including code limits, styles, TypeScript, links and module import rules. Runs the fast tests, builds every page and runs the browser tests.                                                 |
| `bun run format`                  | Writes the project's formatting to your files.                                                                                                                                                                                     |
| `bun run lint`                    | Checks the code with Oxlint and ESLint, including TypeScript-aware rules and size and complexity limits.                                                                                                                           |
| `bun run test`                    | Runs the fast Vitest tests in `unit/` and each game's `*.test.ts`. These test the game rules and the gate's own scripts without a browser.                                                                                         |
| `bun run explore [--seed <seed>]` | Runs only properties, with 512 cases per property and a two-minute limit. It prints the seed so you can replay the run.                                                                                                            |
| `bun run test:coverage`           | Runs those tests and shows which lines and branches they reached. Open `coverage/index.html` for the full report.                                                                                                                  |
| `bun run build`                   | Builds the list of games, the starter, every `examples/*/index.html` and their licence notices into `dist/`.                                                                                                                       |
| `bun run test:e2e`                | Plays the last build in Chrome for Testing: `tests/` and each game's `*.spec.ts`. Run the build first.                                                                                                                             |
| `bun run test:boot`               | Runs only `tests/boot.spec.ts`: every page of the last build starts in Chrome for Testing without an error. The Pages workflow runs it before it publishes.                                                                        |
| `bun run check:links`             | Checks links and anchors in the checkout's Markdown. The full check also checks the built games' pages and assets.                                                                                                                 |
| `bun run check:links:external`    | Checks public web addresses in the documentation. Run it before sharing docs that depend on an external page.                                                                                                                      |
| `bun run check:dependencies`      | Checks the licences and install scripts of the installed dependencies, the game's and the studio's, whose packages it installs from the lockfile first. The gate also requires exact versions in the package lists.                |
| `bun run check:advisories`        | Asks the public package registry about known vulnerabilities. Run it when you want a fresh advisory check.                                                                                                                         |
| `bun run check:staged`            | Checks the Git index, the snapshot going into a commit. Run it after staging to see what the commit hook will see.                                                                                                                 |
| `bun run mutation`                | Uses Stryker to measure which changes the fast tests catch in the game rules, path selection, dependency checks and the check lock. Two workers, up to 15 minutes. It writes a JSON report to `node_modules/.cache/mutation.json`. |

Write generated rules as `test.prop([...])(name, fn)` from `@fast-check/vitest` in
`unit/**/*.prop.test.{ts,mjs}`, a game's in its folder. Keep concrete values and regressions in ordinary test files.
Use `unicodeString` from `unit/property-setup.ts` for varied text and `examples` for exact
boundaries. The fast suite uses seed 17401 and 64 cases per property. Stryker uses 12.

Oxlint owns the general code rules. ESLint covers the remaining checks and checks that tests have
bodies. The gate compares their effective rules for every source file. Stylelint checks CSS in every
game page and the optional studio's HTML. Dependency Cruiser checks imports across the checkout,
including cycles, imports from the starter into a game and from one game into another or the starter. The [example architecture](example-architecture.md)
lists the size and complexity limits for the starter and examples, and the example's import rules.

## Where each check runs

Seconds are wall-clock on an Apple M3 Max with other work running, measured 2026-11-22; CI seconds
are GitHub's.

| Stage                                    | Checks                                                                                                                                                                                                                                                                                                                                                                                                                         | Seconds                             | Why here                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Agent hook: a Claude Code session starts | Frozen install.                                                                                                                                                                                                                                                                                                                                                                                                                | 0.2                                 | A session works on the lockfile's versions from its first command.                                          |
| Commit hook                              | On a copy of the staged snapshot: required files, possible credentials in the staged files, local links in all Markdown. Prettier, Oxlint with size and complexity limits, ESLint and Stylelint on the staged files. Staged lint runs without TypeScript types. Exact versions and licences when a dependency file is staged, the comparison of both linters when a lint configuration is staged.                              | 2.9                                 | Checks that read one file answer while the change is still in your head.                                    |
| Push hook                                | Frozen install, formatting and structure of the whole checkout, local links. A change to game code adds type-aware lint with size and complexity limits, styles, Dependency Cruiser's import rules for the module boundaries, the linter comparison, TypeScript, the unit tests, the build and its links. A dependency change, a change to the gate itself or a new branch runs all of them plus licences and install scripts. | 1.2 for Markdown, 2.1 for game code | Checks that need the whole project take seconds, and this is the last moment before others see the commits. |
| Full check: `bun run check`              | Every push check, then all browser tests.                                                                                                                                                                                                                                                                                                                                                                                      | 373, the browser tests 371 of them  | Playing the game in Chrome takes six minutes, too long for a hook.                                          |
| CI on a pull request: `check.yml`        | Every push check, the build and `bun run test:boot`. Not the other browser tests: GitHub's runner has no GPU, and 70 of the first 87 failed there.                                                                                                                                                                                                                                                                             | 31                                  | The checks that pass anywhere, on a machine that is not the author's.                                       |
| CI on a push to `main`: `pages.yml`      | Build, `bun run test:boot`, then the publish to GitHub Pages.                                                                                                                                                                                                                                                                                                                                                                  | 45                                  | A page that does not start never replaces the public one.                                                   |
| On demand                                | `bun run mutation` (40.69 for the example rules and gate scripts), `bun run explore` (up to 120), `bun run check:advisories`, `bun run check:links:external`.                                                                                                                                                                                                                                                                  | as listed                           | They need minutes or the network, and their result does not decide one change.                              |

The hooks print which checks they skipped. A commit never runs the import rules: they run at push.

Switching branches or merging installs again when the dependency files changed. Claude Code's
startup hook also runs a frozen install. A busy checkout reports the lock and its process ID. Wait
for that command to finish before retrying. A lock left by a run that was killed is taken over by the next one.

Mutation tests are a separate local command. Pass `--mutate` a file or a comma-separated list of
files to select what Stryker mutates.

The optional studio has its own install and check.
In `studio/`, `bun run check` builds the trailer inputs and checks the sample greeting and video
compositions. You can build and share a game with the commands in the root folder.
