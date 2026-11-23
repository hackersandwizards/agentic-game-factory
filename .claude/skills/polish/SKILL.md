---
name: polish
description: >-
  Full-repo quality pass (comment sweep, quality, performance and security review, /simplify, a second
  review, commit and push), when the person asks to polish, clean up or quality-pass the repo or its
  code, never for a quest that polishes the game's look or feel.
---

# Polish

Polish finds defects by reading code and instruction artifacts as written.

An argument narrows what each phase covers, never which phases run. Report what the scope excluded.
The argument `since <commit>` sets `BASE` to that commit and the scope to `$BASE..HEAD`.

The argument also scopes where you hunt for defects, never which proven defects you may correct.
Once a fact is verified false, fix every live copy of it, the generator that produced them
included, in files the argument never named. The phase 1 exclusion set still binds.

A finding handed to a delegate is a brief line carrying file, lines and change in full: the
delegate has none of this skill.

## 1. Preflight

Once the repository is updated, run `git status` and record every file it reports as modified, staged, or untracked. That list is this run's exclusion set. A dirty tree does not stop the run.

Review and fix committed changes only. Never edit a file in the exclusion set: polish commits what it edits, and committing one would sweep in its author's uncommitted work. Report those files as deferred, for the next run once their author has committed.

Run `bun run check` once and record the result: this baseline separates a pre-existing failure from one the sweep caused. A subagent reporting a red gate mid-run is usually reading another agent's half-finished edit.

## 2. Comment sweep

Subtract the exclusion set from the source files before batching: the batch reviewers never see phase 1.

Fan out one reviewer per directory batch, told to read the Comments section of [failure-modes.md](references/failure-modes.md) and to report comment changes only, not make them. Spot-check one file per batch.

Tell each batch that zero changes is an acceptable result. Before deleting a comment on a magic number, grep the file for the other numbers doing a similar job: where a sibling uses a different value, the comment is the only statement that the divergence is deliberate, so keep it.

## 3. Quality, performance, security review

In Claude Code, run `/code-review high` and `/security-review` over the scope yourself, as the reviewer, first; their findings join this phase's fix list. `/security-review` reads the pending changes of the session's own repository, whatever its arguments name: where those are not the scope, and in any other agent, review the scope's diff for security by hand and say so.

Measure performance on a build the run serves itself on a free port: the load of both pages and the frame time `tests/perf.spec.ts` prints. Report before and after numbers for each fix in the repository's one `docs/YYYY-MM-DD-performance.md`, written with today's date, deleting the previous one in the same commit. Serve the before state from a detached worktree on the commit before the fix, measure before and after back to back so each pair shares its load, and write the 1-minute load average beside each series. Before each batch, wait up to five minutes while that load exceeds the core count (`getconf _NPROCESSORS_ONLN`), then measure anyway.

Fan out one subagent per module or top-level directory to review it for minimalism, design, performance and security, with the path of `references/failure-modes.md` in its prompt to read in full. Reviewers report and do not edit.

Review the instruction artifacts as their own module: `.claude/` rules and skills, plus `CLAUDE.md` and `AGENTS.md`. Look for a pointer to a path that no longer exists, a cap or boundary that contradicts an always-on rule, one rule stated twice inside a single skill or among the artifacts that are not skills, and any skill pointing outside its own directory at another skill, rule or agent file by link or by name.

## 4. Gates

In Claude Code, run `/simplify` on the accumulated diff yourself, as the reviewer. Its findings are this phase's fix list.

Then run phase 3 again over the accumulated diff rather than the tree.

Run mutation testing over the source files in the scope it covers (`bun run mutation --mutate <files>`). Give each mutant that survives in a line the scope changed a test through the module's interface, or name it in the summary as equivalent.

One pass of each. Name any finding you dismissed, and why, in the final summary.

## 5. Verify

Run `bun run check` on its own line and read `$?`. "A gate that ran but was never read" in `references/failure-modes.md` names this phase's traps.

A failing check blocks the commit. Fix it if the sweep caused it; report it and stop if it predates the sweep. A failure traced to a file in the exclusion set is another session's half-finished edit: wait for the gate to clear, and report it and stop if it does not. Never bypass the hook to get past it.

## 6. Commit and push

Re-run `git status` and drop any file that became dirty since phase 1 without an edit of yours, and commit each batch that passes the gate. Push, and check that `git status -sb` shows nothing unpushed. Then bring the root Markdown files (README, CONTRIBUTING) in line with what the code now does.

Where the pass changed what a player sees or feels, run the `game-review` skill on the pushed commit.

Report each fix with the check that goes red without it, each finding left unfixed and why, the
decisions left for the person, and the gate result with the pushed commits.
