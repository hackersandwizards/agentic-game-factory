---
name: playtest
description: Plays the game in a headless browser, presses keys, saves screenshots and reads console errors, so the agent sees what the player sees. Use after every visible change, before saying a step works, and when the person reports a bug on screen.
---

# Playtest

With the `chrome-devtools` tools (the headless browser from `.mcp.json`), use them:

1. Open `http://localhost:5173/examples/<game-name>/` (the example: `/examples/present/`) with `new_page`; where nothing answers
   there, start `bun run dev` in the background first. It lists the pages; pass that page's number as `pageId` to the other tools.
2. Play with `press_key` (a tap; for a held key, such as running, use the script below) and look
   with `take_screenshot` after each step that reaches what you changed. Read the console with `list_console_messages`; an error is a bug to fix first.
3. For speed, record `performance_start_trace` while playing, then `performance_stop_trace`.

Without those tools, use the script:

1. Run the script with the page and the steps that reach what you changed:

   ```sh
   bun .claude/skills/playtest/playtest.mjs /examples/<game-name>/ ArrowRight:600 Space wait:500
   ```

   - Page: `/examples/<game-name>/` for the person's game, `/examples/present/` for the example.
   - A step is `wait:MS`, `KEY` (a tap), `KEY:MS` (hold) or `KEY+KEY:MS` (hold together, such as
     `ArrowRight+Space:400` to jump while running). Key names are Playwright's: `ArrowLeft`,
     `Space`, `KeyR`, `Enter`.
   - It starts its own dev server, so `bun run dev` may run alongside.
   - `--out=DIR` saves the screenshots to `DIR` instead of `playtest/`; `--url=URL` plays a server
     already running, such as a `vite preview`, instead of starting a dev server; `--viewport=WxH` sets the page size (default `960x540`).
   - `--cover` also saves the canvas after the last step as the game's `cover.webp`, 640x360, its picture
     on the root page: end the steps on a moment that shows the game, with `--viewport=1280x720`.

2. Open every screenshot path it prints as an image (the Read tool in Claude Code). It saves one at the start and one after
   each step to `playtest/` (ignored by git, replaced on every run).
3. Say what you see in each screenshot and compare it with what the step should show. A difference
   is a bug to fix before you report the step as done.
4. The script exits with code 1 and lists console errors when there are any. Fix them first.

Key presses run in real time, so positions vary by a few pixels between runs. To check a rule
exactly, write a Playwright test in the game's folder instead.

Browser: the script uses the same Chrome for Testing as the tests (`tests/chrome.ts`), downloaded on
first use.
