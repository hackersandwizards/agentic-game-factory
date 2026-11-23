# Coupling

The game builds, tests and runs from its own checkout and the packages it pins, and its tools
write no file outside the checkout: built helpers and fetched data go to a git-ignored folder
inside it, such as `node_modules/.cache/<tool>/`. Chrome for Testing alone stays in the shared
cache puppeteer or Playwright installs it to.

- Take what another project owns from what it publishes: a package installed at an exact version,
  run through its `bin` commands as `bun run <name>` and imported only through the files its
  `exports` names, or a URL its owner publishes. A sibling path (`../<repo>`), a package path
  outside `exports` and another repository's checkout belong to their owner and may move.
- Write only into this repository.
- Take a fact another project owns, such as a brand value, from its package, never retyped or
  copied. The one copy allowed is a file the repository serves while it cannot install the
  package, recorded beside the copy with its origin and version.
- Read a dependency's licence before adding it, and decide whether this project may take it under
  that licence: what the licence demands (copyleft such as GPL or AGPL, attribution, non-commercial
  or source-available terms) against how the project is used and passed on (a public repository
  under MIT, a game anyone may fork). Add one whose terms the project cannot meet only with the
  person's decision. `bun run check:dependencies` is this project's licence check, and it decides.
- Where two projects only look alike, each keeps its own code rather than sharing a package.
