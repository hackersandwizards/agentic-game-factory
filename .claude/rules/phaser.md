---
paths:
  - "src/**"
  - "examples/**"
---

# Phaser 4

Most Phaser code online and in model training data is Phaser 3, and many v3 APIs changed or are
gone. Phaser ships its own agent skills, matched to the installed version, in
`node_modules/phaser/skills/<topic>/SKILL.md`. Read the matching one before writing Phaser code for a
topic; read `v3-to-v4-migration` when you are unsure an API still exists. Topics a small game needs:
`game-setup-and-config`, `physics-arcade`, `input-keyboard-mouse-touch`, `sprites-and-images`,
`animations`, `tilemaps`, `cameras`, `tweens`, `scenes`, `audio-and-sound`. Where a skill and
`node_modules/phaser/types/phaser.d.ts` disagree, the types win; `tsc` in `bun run check` catches
APIs that no longer exist.

Phaser 4.2.1 runs a frame's key events again with each new key event: a key handler that flips or
counts something takes each event once, as `onKey` in `examples/present/systems/keys.ts` does.
