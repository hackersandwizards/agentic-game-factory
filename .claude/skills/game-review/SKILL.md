---
name: game-review
description: Has a fresh agent that saw none of the building play the whole game and rate it from several roles, then fix and re-review with a new blind reviewer until the verdict is ship. Use for "review my game", "blind review", "is it ready", "rate the game", "is it good enough to share".
---

# Game review

The builder knows what the game should do and stops seeing what it does. A reviewer who saw none of
the building plays it and judges it; a heuristic pass like this finds the general problems early, and
the person playing finds the rest [HEP]. Run it before sharing the game and after a quest that
changed how it looks or plays.

## Loop

1. Where the game's look changed since its `cover.webp`, save a new one with the `playtest` script's
   `--cover`. Commit, so the reviewer reviews one fixed version. Done when `git status` is clean.
2. Start a fresh reviewer with the prompt below as a subagent, so this session stays to read its
   report. Where your agent has no subagents, the person starts a second session in another
   terminal, pastes the prompt and brings back the report. Never reuse a reviewer, and give it no summary of the work. Done when it has the
   prompt and nothing else.
3. Read its report. Open every screenshot it names and reproduce each must-fix before fixing it; a
   finding that does not reproduce goes back as rejected, with the reason. Done when each finding
   is marked accepted or rejected.
4. Fix the accepted must-fix findings, following the `quest` steps for the change (playtest, check,
   commit). Show the person the nice-to-have list; each one they want becomes a quest in `GAME.md`.
   Done when `git log -1` holds the fixes.
5. Repeat from step 2 with a new reviewer. Stop when a reviewer's verdict is `ship`.

## Reviewer prompt

Fill in the angle brackets and hand over exactly this:

> You review a browser game you have never seen. Repository: `<path>`, the game: `/examples/<game-name>/`. Read `README.md`, build and
> run the game the way it says, and play all of it in a headless browser, the way the `playtest`
> skill describes, its script with `--out=<scratch dir>/playtest --url=<your preview URL>` (`--viewport=WxH` sets the size; touch
> and pixel ratio need your own script): title, the whole level, dying and respawning, game over, winning, restarting,
> mute, every opt-in mode, and a phone in landscape and portrait by emulation (320 px, Playwright's "iPhone SE", and 375 px).
> To reach winning and game over, reuse the tests' autopilot and state helpers where the repository
> has them (in the kit: `startAutopilot` and `level` in `tests/game.ts`; copy their logic into a scratch script, since
> they cannot be imported from outside the repository) instead of writing your own.
>
> Write nothing inside the repository. Put screenshots and notes in `<scratch dir>`, build with
> `bun run build -- --outDir <scratch dir>/dist` and serve that with
> `bun --bun vite preview --outDir <scratch dir>/dist --port <free port>`. Stop only processes you started, by their PID; never kill
> a process by name or port. Run the repository's tests against that build with
> `TEST_DIST=<scratch dir>/dist TEST_PORT=<another free port> bun run test:e2e --output <scratch dir>/test-results`.
> At the end, stop your servers and delete `<scratch dir>/dist`.
>
> Rate the game 1 to 10, with reasons and, for every score below 10, a ranked list of what would earn the missing points, from each role: creative director (look), senior game
> designer (feel and depth), the player who receives it (fun, would they share it)<, and a
> non-developer who wants to fork the kit>. Check every line of the criteria in
> `.claude/skills/game-review/SKILL.md` that the game has a surface for.
>
> Report: the role scores; then findings, most costly first, must-fix apart from nice-to-have, each
> with steps to reproduce, a screenshot path and a concrete fix. Report only problems you saw;
> an empty list is a valid answer. End with one line: `verdict: ship` or `verdict: fix`.

Add the fork role only when the game ships as a kit for others; add any role only where the game
has that surface.

## Criteria

- Look: every layer on one pixel grid; hero and enemies read against the background; light and depth; the climax is visible, not hidden behind the hero; a cut to video or another medium hands over without a seam (compare the video's last frame with the game's first title frame at native pixels, with a pixel-offset search or PSNR rather than an amplified difference image, which makes compression noise look like misalignment; a changed bottom line, falling snow and animated elements differ on purpose); text crisp at whole-number scales.
- Feel: coyote time, jump buffer, variable jump height, corner correction [Celeste]; hits land with a short freeze, shake and particles [Feel]; the camera looks ahead.
- Depth: difficulty rises through placement and enemy behaviour; more than one verb or something to master; a bot that only holds right and jumps does not win untouched; a reason to replay (score, rank, best time, secrets). Length is judged against the scope in `GAME.md`, if it exists.
- Performance: run `tests/perf.spec.ts` (its header says what it measures and why) and report its numbers with the renderer string, the machine load and that these are not phone numbers.
- Mobile: touch targets at least 44 CSS px; nothing overlaps the controls on the smallest phone; a portrait layout; touch prompts say tap, not a key name.
- Robustness: no console errors or warnings; mute and opt-in modes survive a reload; no state stuck after overlapping effects (a sprite left half transparent).
- Video (where the game has one, such as the studio's): loudness -14 LUFS ±0.5, true peak at most -2 dBTP; the QR code decodes to its target (Chrome's `BarcodeDetector` works headless); every line stays complete on screen for at least 2 s.
- Fork (kit only): prerequisites named; no coding experience assumed; the Windows symlink step works.

## Sources

[HEP]: https://hci.rwth-aachen.de/materials/conferences/CHI2004/2p1509.pdf
[Feel]: https://arxiv.org/abs/2011.09201
[Celeste]: https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs
