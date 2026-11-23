---
name: engineering
description: >-
  How to build and change software here (docs over code, when to ask, what never to simplify, comments,
  silent-failure gates), before implementing a feature, refactoring, fixing a bug, reviewing a change or
  planning non-trivial repository work, never for prose edits.
---

# Engineering

Architecture docs (`CLAUDE.md`, the rules, `docs/example-architecture.md`) outrank existing code
where the two disagree. Given a bug report, fix it on its best reading without asking, and name any
other defensible reading with the fix. Ask first only where no fix can start: the requirement
contradicts itself or names a missing artifact. Fix a bug test-first: a failing test that
reproduces it, then the fix. Before editing the function a bug report names, read every caller, and
fix the defect once where they all route through rather than on the one path the report names.
Never simplify away input validation at a trust boundary, error handling that prevents data loss,
security measures, or accessibility basics.

- Cleanup, review and quality passes scan the whole working tree, not only the files this
  conversation touched. Another session's in-flight change sits beside today's work: read it for
  context and leave it to its author. An unstaged change you revert is gone from git for good.
- A parser answering "malformed" with the same value it gives "legitimately empty" turns a loud
  failure into a silent one. Put that gate at the parser, never at each consumer.
- Write no comment except for a fact neither the code nor a doc file states, such as why a feel
  number has its value, a Phaser quirk, an ordering constraint or the bug a guard exists for. Keep
  directive comments. A comment cites a commit, never a dated report, which a later report replaces.
- While you work, verify each change with the checks that fit it, from the commands `CLAUDE.md`
  lists. The full `bun run check` before the commit is the only run that plays the game: CI leaves
  the long browser tests out.
- A commit hook holds only what is irreversible or takes about a second, run over the staged
  changes: the secret scan, format and lint. What needs the whole project runs at push, and what
  takes minutes in the full check or on demand. `docs/checks.md`, "Where each check runs", places
  each check: put a new one in the stage its cost fits.
- Start every tool the project installs through `bun run`: a package.json script where one fits,
  else the project's own binary (`bun run vitest run <file>`), never `bunx`, `npx` or
  `node_modules/.bin`. A person runs the repository's scripts through package.json scripts, never
  by path. A commit that adds or changes a command a person runs also changes the README,
  `CLAUDE.md` and `docs/checks.md` passages that list such commands.
- Read `bun install`'s `Blocked N postinstall` with `bun pm untrusted`, and name each blocked
  script with its package in the report.
- Remove or replace a dependency with a known vulnerability before excusing it. An audit
  exception names the advisory ID.
- A browser that code or an MCP server starts is Chrome for Testing with a profile from `mkdtemp`
  under the OS temp folder, removed after the run, and `--use-mock-keychain --password-store=basic`,
  which puppeteer and Playwright pass themselves and a direct launch adds.
- Screenshots compared across two builds use software drawing (`--disable-gpu`), a fresh profile
  with the cache off per build, the same waits with animations stopped and lazy images loaded, and
  each image's pixel size read back. Shoot each build twice: a difference between one build's own
  two shots is noise, never a finding.
- A run that needs a running game starts its own server on a port it probed free on IPv4 and IPv6
  (`lsof -nP -iTCP:<port> -sTCP:LISTEN` prints nothing), reads the listener's PID as its own before
  the first request it measures or captures, and stops it by PID when done. It never stops a server
  it did not start, except a dev server of the person's that needs a restart to load a change this
  session made: restart that one by its listener's PID and name it in the report.
- Removing a module or a skill also deletes the tests that named it. Port every deleted case whose
  subject still exists: no gate goes red when coverage disappears.
