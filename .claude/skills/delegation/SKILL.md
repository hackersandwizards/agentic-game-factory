---
name: delegation
description: >-
  Launch, prod, stop and check a delegate (a subagent or a second session), where the model and
  effort are pinned, and how Claude Code and Codex hand each other work where both are installed:
  before starting any delegate and when running or configuring Codex.
---

# Delegation

## Running a delegate

- Launch only while the 1-minute load (`uptime`) is at or below the core count
  (`getconf _NPROCESSORS_ONLN`): hold up to ten minutes, then launch one alone. A whole gate, a
  browser suite or a load run runs one at a time.
- Launching a queue of several runs in an attended session, tell the person its estimated end as a
  clock time a command printed, and the time per run it rests on.
- In Claude Code, delegate to an Agent-tool subagent of the session you are in, never to a nested
  `claude -p` process.
- Prefix every scratch file with its run: delegates share the scratch folder, and a resume guard
  adopts another run's files. Never delete scratch by a glob while a delegate runs.
- A brief's stop condition names which hits count: the tracked source (`git grep`), never reports
  or build output.
- A session that delegates its procedure delegates every request a person adds later too.
- Prod a quiet agent with SendMessage; never spawn a replacement. A prod waits for the agent's next
  tool round: where its transcript (`subagents/agent-<id>.jsonl`) gains no entry within fifteen
  minutes of the prod (a prod that landed took up to nine), stop its task with TaskStop and send the
  prod again, which resumes it with its context. Where it is gone for good, do its phase
  yourself.
- Stop a finished delegate's task before the process it left, or it wakes to re-report everything.
  Stop a process by its PID after reading its command line, never by pattern.
- Before telling the person a background run is still working, read its log's last lines and its
  process in that turn: a monitor that ended without an event is no evidence, and a log ending in an
  API or connection error is a stopped run to relaunch.
- Attended, while a delegate or background run you started works, give the person a status after
  each one finishes and every 20 minutes at the latest: after each status, stop the previous timer
  with TaskStop and start `sleep 1200` as a Bash call with `run_in_background: true`, whose
  completion wakes the session.
- After a stall, timeout or resume, reconcile the delegate's commits and working tree against its
  report and hand back any contradiction. Before relaying a defect as fixed, sweep the repository
  for its class.
- A brief for code work asks the report to list every assertion, threshold, fixture or pinned
  expectation the run changed, each with its old and new value and the reason. One a review finds
  unlisted is a finding, whatever the suite reports.
- Before launching on a brief built from a template or a script, search the written file for
  unfilled placeholders (`{name}`, `$VAR`) and empty paths: the delegate improvises a value for
  each, and parallel delegates improvise the same one.
- Verify a claim before retracting it to a running delegate. Before asking the person, re-read
  the delegate's instruction: decide it there, or hold the work and ask, never both.

## Model and effort

`.claude/settings.json` pins the model and effort for Claude Code and `.codex/config.toml` for
Codex. Read the value there.

- `codex exec --model <model>` and `-c model_reasoning_effort="<effort>"` override the pin for
  one invocation. Heavier one-off work, such as planning, a hard bug or architecture, goes there,
  not into the pin.
- `codex exec` has no `--full-auto`: the workspace-write auto-review is `--approve-for-me`. With
  an open pipe on stdin it waits for EOF before starting, so pass `< /dev/null` where stdin might
  be open.
- Codex's sandbox blocks what `AGENTS.md` lists: a `codex exec` run that installs, opens a port,
  starts the browser or writes to Git needs the person's approval to run outside it.
- A skill's `agents/openai.yaml` is ungated: bump its `short_description` by hand in the commit
  that adds a mode.

## Between Claude Code and Codex

This section holds only where both are installed and signed in (`codex login status`). Otherwise
the session does the work itself, and a second subagent takes the review.

- Claude hands Codex the code work: implementation, bug fixes, refactors, tests, scripts,
  dependency updates and the polish pass, run as `codex exec` in the repository. Public web
  research goes to `codex --search exec`; before a result reaches the person, Claude checks its
  version numbers and dates against the cited source. Claude keeps the conversation with the
  person, rules, skills and every text a person reads, reviews what Codex produced, and pushes
  after the review.
- Codex hands Claude every piece of prose a person reads outside the conversation, such as the
  README or the game's texts. Its own conversation with the person it writes itself.

  ```sh
  claude -p "Write the <text>. Facts: reader, language, purpose, must and must-not facts. Output only the text."
  ```

  Check facts (names, dates, links, language), content correctness and length, never phrasing or
  tone. On a finding, call `claude -p` again with the previous text plus the concrete finding.
  Deliver the output verbatim: any text change goes through another `claude -p` call.

Verify what a run did with `git log`, never from its own summary.
