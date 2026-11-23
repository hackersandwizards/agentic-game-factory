# Contributing

A fix or an improvement to the kit reaches it as a pull request against `main`.

1. Fork the repository, run `bun install` and make a branch.
2. Write the test first and watch it fail: a rule of the game in `unit/`, anything a player sees in
   `tests/`. Then make the change that turns it green.
3. Run `bun run check` before you push. It takes about six minutes, most of it the browser tests.
   [Check commands](docs/checks.md) lists what runs at commit, at push and in the full check.
4. Open the pull request. GitHub runs every check but the long browser tests, which need a GPU, so
   your own `bun run check` is the one that plays the game. A maintainer reviews and merges, and a
   merge to `main` publishes every page.

Keep one change per pull request, and never loosen a test or a lint rule to get it through. For a
vulnerability, write to the address in [SECURITY.md](SECURITY.md) instead of opening an issue.
