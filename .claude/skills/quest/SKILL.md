---
name: quest
description: Builds the person's game one quest at a time from GAME.md, teaching one agentic-engineering habit per quest and ending each with play, review, the check gate and a commit. Use when GAME.md exists, or for "quest", "next quest", "continue my game", "what's next", "build my game", "polish my game".
---

# Quest

Each quest builds one playable step and practises one agentic-engineering habit. Teach by doing: name the habit, explain it in at most three sentences,
then use it in the quest. Where `GAME.md` says the person works with a coding agent every day, keep
each explanation to one sentence.

`examples/<game-name>/GAME.md` comes from the `game-wizard` skill. If it does not exist, or has no `## Quests`
section with `- [ ]` lines, tell the person to run `/game-wizard` first (Codex: "Start the
game-wizard skill") and stop.

## Before quest 1

When no quest is marked `- [x]` yet, check the setup: `node_modules/` exists, otherwise install. Play `/examples/<game-name>/`
with the `playtest` skill and look at the screenshot. Done when it shows the square on a dark
background; if the browser fails, show the person the error: Chrome for Testing downloads on the first
run and needs network access.

## Run the next quest

1. Read `GAME.md` and `CLAUDE.md`, and take the first quest marked `- [ ]`. If none is open,
   congratulate the person, offer the "Ship it" habit if it has not run, and offer to plan three more
   quests from the "Not in v1" list.
2. Pick the quest's habit: quest 1 is always "Plan mode", the share-it quest is "Ship it", otherwise
   the habit from the table below that fits the quest best and is not yet used in `GAME.md`. Tell the
   person the quest and its habit.
3. Plan: at most five bullets plus "you will see: ...". Wait for the person's OK.
4. Build the smallest slice that meets "Done when", following the engineering principles in
   `CLAUDE.md`. A quest line that names a mechanic carries its rules, hook and source: build to
   those and write its test first. For a quest that polishes look or feel, read
   [polish.md](polish.md) first.
5. Run the `playtest` skill, open every screenshot, and fix until the screenshots show what you
   promised and the console shows no errors.
6. Ask the person to play it at `http://localhost:5173/examples/<game-name>/` (they run `bun run dev`). Apply small
   feedback now; write bigger ideas as new quests at the end of `GAME.md`.
7. From quest 2 on, review the diff (see "Review"). Fix every finding you accept, and tell the person
   which findings you rejected and why. Quest 1 stays at plan, playtest, check and commit.
8. Run `bun run check` until it passes. Mark the quest `- [x]`, append to its line `Habit: <habit>.` and one sentence
   saying what you learned, and commit. Done when `git log -1` names the quest.
9. From quest 2 on, in Claude Code with an `origin` remote (the person's own copy on GitHub): run
   `/security-review` on the commit before pushing it (see "Review") and fix what it finds in a
   follow-up commit.
10. Stop. Suggest starting the next quest in a fresh conversation (`/clear` in Claude Code, `/new` in
    Codex) with `/quest` (Codex: "Start the quest skill"), since a long conversation makes the agent slower and less precise.

## Review

Claude Code: run `/simplify` (it applies its cleanups), then `/code-review` on the uncommitted diff.
After the commit, `/security-review` compares the branch with `origin/HEAD`; where it fails with
`ambiguous argument 'origin/HEAD...'`, run `git remote set-head origin --auto` once, and where there
is no remote, use the checklist instead. If one of the commands is missing in the person's version,
use the checklist for it.

Other agents, and any command that is missing: read `git diff` and answer each line with yes or a fix.

- Minimal: no code the quest does not need, nothing Phaser already does, no unused files, sprites or
  debug code left.
- Correct: every rule this quest added has a test or a screenshot that shows it; no test skipped or
  loosened.
- Frame budget: no allocation, Graphics drawing or new listener inside `update()`; particles and
  bullets come from a pool.
- Secure: no secret, `eval`, `new Function` or `innerHTML` with data; no script, font or file loaded
  from another site at runtime; a new dependency is pinned and the person agreed to it.
- Assets: every file from elsewhere has a row in the game's `CREDITS.md`.

## Habits

| Habit                         | Practise it like this                                                                                                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan mode                     | Claude Code: the person presses Shift+Tab until "plan mode" shows, you plan, they approve. Other agents: plan in the chat and wait for an OK before editing.                                                        |
| Grill me                      | Before planning, ask the person questions one at a time until you both agree on what "done" looks like; then plan.                                                                                                  |
| The agent checks its own work | Use `playtest`, open the screenshots, and say what you saw before saying it works.                                                                                                                                  |
| CLAUDE.md as memory           | Write a decision the next session needs in the game's own `CLAUDE.md`, beside its `GAME.md`.                                                                                                                        |
| Git save points               | Commit after the step works. Try a risky idea, and if it fails, return to the last commit.                                                                                                                          |
| Test first                    | Write a Playwright test, a `*.spec.ts` in the game's folder, for one rule, such as "collecting a coin raises the score", run it and see it fail, then build until it passes. Expose the value it reads on `window`. |
| Autopilot                     | A test that plays the level with scripted key presses and asserts the player reaches the goal, so a change to jump height or the level layout that makes it unbeatable turns the gate red.                          |
| A skill of your own           | Write `.claude/skills/<name>/SKILL.md` for a task you repeat, such as adding a level or a sprite in your format, then use it.                                                                                       |
| Subagents                     | Hand a side task to a subagent, such as drawing sprites while you write game logic, or reviewing the diff.                                                                                                          |
| Hooks                         | Claude Code: add a hook to `.claude/settings.json`, such as running prettier after every file edit. Other agents: add a check to `scripts/staged.mjs`, which the commit hook runs.                                  |
| Measure first                 | Before optimising, run the frame-time probe (`tests/perf.spec.ts`) on the person's page, change one thing, measure again, and keep the change only when the number improved.                                        |
| Context hygiene               | Start the quest in a fresh conversation and let `GAME.md` and `CLAUDE.md` carry the context.                                                                                                                        |
| Small diffs                   | Ask for the change in the fewest lines, then review the diff with the person before committing.                                                                                                                     |
| Ship it                       | `bun run check:advisories` shows no high or critical finding and `bun run build` passes. Publish as the README's "Share" section says (GitHub Pages, or itch.io). Open the published URL and play it once.          |
