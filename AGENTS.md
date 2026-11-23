# AGENTS.md

Read `CLAUDE.md` and follow it: it is this repo's instruction file for every coding agent. Before
the first change, read every file in `.claude/rules/` too: Claude Code loads them itself, other
agents do not. The skills `CLAUDE.md` names are in `.agents/skills/` (the same folder as
`.claude/skills/`).

Claude Code: `.claude/settings.json` pins the model and the effort. Where the person's plan lacks the
pinned model, tell them to pick one with `/model`.

Codex:

- `.codex/config.toml` loads once the person trusts this folder. It pins the model, turns on live
  web search for `game-wizard` and starts the `chrome-devtools` server. Where the person's plan lacks
  the pinned model, tell them to pick one with `/model`.
- The sandbox blocks the network, local ports, Chrome and writes to `.git`. Measured on macOS:
  `bun run test:e2e` fails there with `Port 0 is already in use`, with the network allowed Chrome
  exits with `SIGABRT`, and `git add` cannot create `.git/index.lock`. Ask for approval to run
  outside the sandbox for a command that installs, opens a port, starts the browser or writes to
  Git: `bun install`, `bun run dev`, `bun run check`, `bun run test:e2e`, the playtest script,
  `git add`, `git commit` and `git push`. `bun run test`, `bun run build` and `bun run format` run inside it.
