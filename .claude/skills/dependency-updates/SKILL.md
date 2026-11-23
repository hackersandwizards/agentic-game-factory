---
name: dependency-updates
description: >-
  Update the repository's dependencies: raise every external dependency of every kind to its newest
  release, majors included, clear advisories, fix what breaks, one commit. Use for "dependency
  updates", "update dependencies", "fix advisories".
---

# Dependency updates

1. Raise every external dependency to its newest release, majors included, with the means the
   repository uses for that kind:
   - packages in `package.json` and `studio/package.json`: `bun outdated`, then
     `bun update --latest` in each folder. Every version stays exact: `check:dependencies` refuses
     a range. An aliased entry (`npm:<package>@<version>`) and an
     `overrides` entry are raised by hand: drop an override its parent no longer needs.
   - Bun itself: `packageManager` and `engines` in both package files.
   - the `chrome-devtools-mcp` version, the same in `.mcp.json` and `.codex/config.toml`.
   - the actions in `.github/workflows/`, pinned as a commit with the tag as a trailing comment.
     That form stays: take the newest tag and its commit from `git ls-remote --tags <url>` (its
     `^{}` line where annotated) and update both.

   Clear every open security advisory `bun run check:advisories` lists, replacing a dependency no
   release fixes.

2. Fix what the updates break until `bun run check` is green, and `bun run check` in `studio/`
   where its packages changed. Roll back only an update you cannot make green.
3. A version a document states (the README's prerequisites, `CLAUDE.md`, `.claude/rules/phaser.md`)
   changes with its raise, after checking that what the passage says still holds for the new
   version.
4. Commit the paths the update changed as one commit and push it. Nothing changed means no commit.
   Skip and name a path another session has modified.

Report the commit hash or "nothing to update", and each dependency or advisory left behind, with
the failing check or advisory ID.
