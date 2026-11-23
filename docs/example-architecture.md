# How the example game is cut

`examples/present/` is "Bring the present home": a title scene and one platformer level. This page is
the contract its code keeps. `bun run check` enforces the limits, the import rules and the named
browser-global restrictions below. Review covers part construction, references between parts, frame
order and other DOM access.

## The game in its own words

These words mean one thing each, in the code, the tests and this page.

| Word       | Means                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Wizard     | The hero: he runs, jumps and dashes, and carries the present                                   |
| Level      | A map text and its backdrop, played from the door to the goal                                  |
| Map        | The level as text, one character per 48 px tile (the characters: `domain/map.ts`)              |
| Run        | One attempt at a level: lives, crystals, kill chain, checkpoint, clock, and how it ends        |
| Pickup     | What he takes by touching it: a crystal, the secret crystal, a heart, the d20                  |
| Bug        | What patrols the level. A stomp or a dash squishes it; any other touch is a hit                |
| Stomp      | Landing on a bug from above; it bounces him, and the next one within 100 ms counts too         |
| Chain      | Kills in a row without standing on the ground; each later kill scores more                     |
| Hit        | A bug's touch or a fall into a pit: it costs one of three lives                                |
| Checkpoint | A Christmas tree he passed, lit from then on: where he goes on from after a hit                |
| Goal       | The laptop at the level's end. Passing its finish line is the win, scored in awards and ranked |
| Game over  | The run's end with no life left                                                                |

## Layers

Each folder is one layer. A layer imports only from layers above it in this table.

| Layer       | Holds                                                                                                        | Knows nothing of                   |
| ----------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `domain/`   | The rules and the run, as plain TypeScript: no Phaser, no DOM                                                | everything else                    |
| `design/`   | Tokens (screen, palette, text style, motion settings), text helpers, the cast's atlas frames, baked textures | the rules, any part, any level     |
| `systems/`  | What works on the whole scene: camera, night light, juice, sound, keys, the 18+ switch and blood             | any entity, any UI part, any level |
| `ui/`       | What the player reads and presses: HUD, hint, popups, touch buttons, end and win panels, bands               | any entity, any level              |
| `entities/` | What stands in a level: wizard, bugs, ground, pickups, checkpoint trees, door, goal, easter eggs             | the UI, any level                  |
| `levels/`   | The level scene, which composes all of the above from a `Level`, and one folder per level                    | which level it plays, the shell    |
| `shell/`    | The entry, the title scene and its parts                                                                     |                                    |

`ui/` and `entities/` stand side by side: neither imports the other.

### The same cut as a web frontend's

| Web frontend                               | Here                                                        |
| ------------------------------------------ | ----------------------------------------------------------- |
| Domain model, free of the framework        | `domain/`                                                   |
| Design tokens, icons, type                 | `design/`                                                   |
| Cross-cutting services                     | `systems/`                                                  |
| Component library                          | `ui/`, `entities/`                                          |
| Page template                              | `levels/level-scene.ts` with `layout.ts` and `reactions.ts` |
| A page: its content filled into a template | `levels/night-forest/`                                      |
| App shell and routing                      | `shell/`                                                    |

## Modules

Use a class for a part that keeps state or Phaser objects across calls, and a function for a
one-off build step or a rule with no state of its own.

| Module                          | Holds                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `domain/run.ts`                 | One run: collect, heal, meet a bug, hurt, recover, pass a checkpoint, the clock, the finish line; the events it announces |
| `domain/score.ts`               | Points, ranks, gold time, clock format, records, earned awards and rank advice keys                                       |
| `domain/combat.ts`              | Lives, how long a hit plays and shields, stomps and their grace, dash kills, kill-chain end and points                    |
| `domain/map.ts`                 | The map's characters and the cell each means, which cells are solid, and the check that a map can be played               |
| `domain/terrain.ts`             | The map as ground: what is solid, the ground below a point, where a fall lands, the pit below the map                     |
| `design/tokens.ts`              | Screen layout, the two scales, the named colours (`COLOR`, `TINT`), text style, motion and orientation settings           |
| `design/text.ts`                | Crisp text at any zoom, hard-edged glyphs                                                                                 |
| `design/art.ts`, `art/`         | Atlas frame names, glow helpers and common textures baked at boot                                                         |
| `systems/sound.ts`              | Effects, music, the mute switch                                                                                           |
| `systems/keys.ts`               | A key listener that ends with its scene                                                                                   |
| `systems/camera.ts`             | Follow, lead, look-down, head room, kicks, whole-pixel scroll and sprite placement                                        |
| `systems/light.ts`              | The night's light mask and the pools of light in it                                                                       |
| `systems/juice.ts`              | Hit-stop, camera shake, shockwave rings, sparkles and hit spin                                                            |
| `systems/blood.ts`              | The 18+ switch and its blood                                                                                              |
| `systems/records.ts`            | Best time and best score, kept in the browser's storage                                                                   |
| `ui/hud.ts`, `hud-html.ts`      | Crystal count, hearts, speaker, timer, on the canvas and as HTML                                                          |
| `ui/hint.ts`                    | Help text, fade and slot changes, dash lesson and bounds for popup placement                                              |
| `ui/popups.ts`                  | The rising lines ("+100", "NAT 20!") and the room they keep                                                               |
| `ui/placement.ts`               | Where a popup line fits among the wizard, other lines and the room it has: plain TypeScript, as `domain/` is              |
| `ui/touch.ts`                   | The four touch buttons, on the canvas and as HTML                                                                         |
| `ui/bands.ts`                   | UI camera, HTML bands and invitation; display-list hook crisps Text and starts objects on the world camera                |
| `ui/end.ts`, `win-panel.ts`     | GAME OVER, invitation and restart; the win's score, rank and records                                                      |
| `ui/konami.ts`                  | The Konami code and its confetti, on the title and in a level                                                             |
| `entities/wizard.ts`, `wizard/` | The wizard: feel numbers, his step (run, dash, jump), his animations and drawing, ghosts, footprints, dust                |
| `entities/bugs.ts`              | Bug kinds, patrol and hop, their drawing between physics steps, squished bugs                                             |
| `entities/step.ts`              | How far the physics clock is into its next step, for drawing between steps                                                |
| `entities/ground.ts`            | Ground and stone tiles, crates, plank bridges and their depth, the candy cane                                             |
| `entities/pickups.ts`           | Crystals, the secret crystal, the heart, the d20                                                                          |
| `entities/checkpoints.ts`       | The Christmas trees: shaking one he brushes past, lighting it                                                             |
| `entities/door.ts`, `goal.ts`   | The workshop door and the step out of it; the laptop, the carried present and the win beat                                |
| `entities/eggs.ts`              | Easter eggs standing in a level: neon sign, terminal, 42 sign, ghost                                                      |
| `levels/level.ts`               | What a level is: its scene key, its map, and the backdrop calls the scene makes                                           |
| `levels/level-scene.ts`         | Level setup from a `Level`, the run's inputs, frame order, help wording                                                   |
| `levels/layout.ts`              | Each kind of cell placed as its entity, and collision wiring                                                              |
| `levels/reactions.ts`           | What the level shows and plays for each event of its run, respawn included                                                |
| `levels/probes.ts`              | The names the tests read on the level scene                                                                               |
| `levels/night-forest/`          | The one level: `map.txt`, its backdrop (parallax, mist, valley, smoke, stars, snow, foreground)                           |
| `shell/main.ts`                 | The Phaser game, its scenes and `window.game`                                                                             |
| `shell/title.ts`, `title/`      | Preload for both scenes, workshop effects, plaques, strip, switches and door flight                                       |

## Who may import whom

The gate (`.dependency-cruiser.cjs`) holds each of these, and forbids cycles. Where a sentence is
held by review only, it says so.

0. Every module lives in one of the seven layer folders.
1. `domain/` imports nothing outside itself, no package either, and uses no `document`, `window`,
   `navigator`, `localStorage` or `Phaser` (`.oxlintrc.json`, and `eslint.config.js` for `Phaser` as
   a type). Other DOM access is covered by review. It is tested in `unit/` and mutation-tested
   (`bun run mutation`). `ui/placement.ts` keeps the same rule and the same tests, and imports
   nothing at all.
2. `design/` imports no other layer.
3. `systems/` imports `domain/` and `design/` only.
4. `ui/` imports `domain/`, `design/` and `systems/`. What it shows of the wizard it is handed as a
   body, a sprite or a callback: no rule can check that, so review holds it.
5. `entities/` imports `domain/`, `design/` and `systems/`.
6. Only `shell/` imports `levels/`, and the level scene and its parts import no level's folder. That
   the shell hands a `Level` to `new LevelScene(level)` is held by review. A level's folder imports
   from `levels/` only its own files and `levels/level.ts`: no other level's folder, and not the
   scene, its layout, its reactions or its probes.
7. Nothing imports `shell/`. Only `shell/title.ts` and its parts import `shell/title/`, only
   `design/art.ts` and its parts `design/art/`, only `entities/wizard.ts` and its parts
   `entities/wizard/`.

## How the run and the screen meet

The level scene feeds its `Run` what Phaser reports: a touched pickup or bug, a fall, where he is
against each tree and against the goal, the scene's time, the first move, the time a hidden tab
took. The run applies the rules: whether a tree is passed, whether the finish line (112 px before
the goal) is crossed, what the clock shows, and that a hit lands once until he moves again and never
after the win or the last life. It keeps the state and announces each change once as an event:
`collected`, `healed`, `squished`, `hurt`, `checkpoint`, `gameOver`, `won`. `Reactions` holds one
handler per event, and that handler is the order on screen: which entity changes, which effect
plays, which UI update, and the sound of that event. A part plays the sound of what it does itself:
the wizard his jump, dash and landing, the door its opening, the goal the win's fanfare, the Konami
code its flourish. Events are transitions only. Nothing is announced per frame, and the frame
methods read the run's fields.

Movement (run, jump, coyote time, jump buffer, dash) and the bugs' patrol stay in `entities/`, on
the Phaser bodies: they are settled inside the physics step, against the bodies' positions and
collisions of that step, and the run has neither. Two rules stay outside `domain/` for the same
kind of reason. A kill refills the dash, in the `squished` handler: the dash's state is the
wizard's. The hit's sequence (the cut, the fade, the blink) runs on the scene's clock in
`levels/reactions.ts`; only how long a hit plays (`HIT_MS`) and shields is in `domain/combat.ts`.

The d20 changes nothing in the run, so it is no event: the scene calls its reaction directly.

## How to add a level

No second level exists, so this path is unproven (see below).

1. Create `levels/<name>/` with a `map.txt` in the characters `domain/map.ts` lists, a backdrop
   that satisfies `LevelBackdrop`, and an `index.ts` exporting a `Level` with a scene key of its own.
2. Add `new LevelScene(<LEVEL>)` to the scene list in `shell/main.ts`, and start that key where the
   game should lead to it.
3. A new kind of object changes these files: `domain/map.ts` (its character and cell in `LEGEND`,
   and `isSolid` if he stands on it) with `unit/map.test.ts`, a part in `entities/`, and
   `levels/layout.ts` (its line in `place()`). One he touches changes four more: `collide()` in
   `levels/layout.ts` and its call in `levels/level-scene.ts`, which reports the touch to the run,
   `domain/run.ts` (the input, the rule and, where the screen answers, an event in `RunEvents`) with
   `unit/run.test.ts`, and the event's handler in `levels/reactions.ts`. Art for it is a frame name
   in `design/art.ts`.

## What is unproven

- The `Level` type has one user. Whether map and backdrop are all a second level needs to differ in
  is a guess until one is built.
- Every map needs a door (`D`) and a goal (`L`), which `checkMap` holds, and the win beat, the
  present and the help line are the same in every level.
- The night, its light mask, the music, the respawn fade's colour and the win panel's greeting are
  wired into the level scene and its parts, and four entities (pickups, checkpoints, bugs, goal)
  take the `NightLight`. Making light, music and fade colour fields of `Level` waits for a second
  level: until then each is an interface for a single case.
- `GOLD_TIME` and `RANKS` in `domain/score.ts` are this level's numbers, and the help line prints
  them. Moving them onto `Level` waits for a second level too.
- A level cannot bring its own kind of entity, rule or reaction: every kind is in `domain/map.ts`
  and `levels/layout.ts` for all levels. A hook on `Level` for that waits for a second level.
- The title scene loads every texture, bakes the shared ones and starts the scene keyed `level`,
  which relies on that order. A second level's own textures and its place in the flow are not
  designed.
- `domain/` still knows two things of the screen: `TILE` and `PLANK_TOP` are pixels, and the `hurt`
  event carries `from`, the side the camera's kick comes from.
- `FEEL` and `GRID_SCALE` stay out of `domain/`: the feel numbers depend on the zoom token.
- Left as they are: the dash lesson in `ui/hint.ts`, the 18+ setting beside its effect in
  `systems/blood.ts`, the four jobs of `systems/sound.ts`, and `entities/wizard.ts` at the line
  limit.
- Best time and best score are stored under one key each, not per level.
- The tests read the level scene keyed `level`.

## Limits

They hold for every game under `examples/`, yours included, and for the starter in `src/`. Blank lines and comments do
not count.

| Limit                   | Value | Why                                                                    |
| ----------------------- | ----- | ---------------------------------------------------------------------- |
| Lines per file          | 250   | One responsibility reads in a few screens; more is a second one        |
| Lines per function      | 60    | A function fits on one screen, a scene's `create()` included           |
| Cyclomatic complexity   | 12    | McCabe's 10, plus the two guards most frame code starts with           |
| Block depth             | 3     | A loop, a condition and one more; deeper logic gets a name             |
| Parameters per function | 5     | A rectangle and a flag; an options object would allocate in `update()` |

## Frame budget first

Continuous stepping and drawing reuse part state and scratch geometry. Frame methods take numbers,
flags or existing objects. Set up cross-part callbacks during scene creation. The run's events and
other transitions, such as a hit, pickup or win, may start tweens or create UI. The camera runs its
follow and sprite placement in one call. The scene orders its frame calls and sets up Phaser hooks.
Wizard and BugPatrol track physics steps. Bands handles objects added to the scene.

## What stays as it is

Behaviour, look, feel and timing. The level scene's frame order: physics, `update()`, then the
draw step after physics. The names the tests read on `window.game`: the level scene's `player`,
`bugs`, `walks`, `corpses`, `trees`, `laptop` (the goal's sight), `present`, `layers`, `fogs`, `fade`, `foreground`,
`mask`, `blood`, `hud`, `hudBacking`, `hudFloor`, `hearts`, `timer`, `help`, `helpMoving`, `lines`,
`padRoom`, `smoothBugs`, `lives`, `won`, `gameOver`, `crystals`, `totalCrystals`, `secret`, `score`,
`chain`, `longestChain`, `kills`, `hits`, `invulnerableUntil`, `startedAt`, and its methods
`hurt()`, `popup()`, `nextRank()`, `seconds()` and `updateHud()`; the object names `hud`,
`controls`, `panel`, `speaker` and `timer`; and `window.FEEL`.
