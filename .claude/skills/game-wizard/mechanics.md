# Mechanics menu

Per mechanic: what it is, a reference game, the rules that make it feel good, a size, and where this
kit hooks it in when the place is not obvious. Sizes are judgement, not measurement: **S** under an
hour with an agent, **M** one evening, **L** more than one evening, so split it into quests that
each stay playable. Copy a chosen entry's rules and source into its quest line in `GAME.md`, and its hook where the
game shares the example's code.

Contents: Platformer · Metroidvania · Puzzle · RPG · Other genres · Any genre · Sources

## Platformer

The example is one: `examples/present/entities/wizard/feel.ts` holds the feel numbers (`FEEL`, every pixel value
scaled by `GRID_SCALE`), `levels/night-forest/map.txt` the layout, `systems/camera.ts` the view, `entities/pickups.ts` pickups and `domain/run.ts` checkpoints.

- **Dash** (S, example has it) · Celeste. A short burst straight ahead in the facing direction, once per
  time in the air. Landing or a kill refills it, and leaving the ground after a ground dash refills it
  once; show readiness on the character (Madeline's hair changes colour) [Celeste]; a
  dash clipping a ledge corner pops up onto it [Forgiveness]. Hook: `dash()` in `entities/wizard.ts`, the staff dimming in `entities/wizard/drawing.ts`,
  and `squished()` in `levels/reactions.ts`, which refills the dash.
- **Wall jump and slide** (S) · Celeste. Wall jumps work from 2 px off the wall at 320x180, so the
  window is wider than the wall; pressing away just after an upward jump still counts
  [Forgiveness]. Hook: probe with the `solid` callback the player already has, no physics query.
- **Double jump** (S) · Super Ghouls 'n Ghosts. Usable at any point of the first jump, it can
  reverse direction mid-air; levels need spots only it reaches, or it is decoration [SGnG]. Hook:
  refill air jumps where `coyote` refills.
- **One-way or auto-scroll camera** (M) · Super Mario Bros. The camera only advances; never turning
  back forces decisions [GamesBeat]. Speed the camera up from about 25 % off centre to avoid a jump
  [Keren]. A wall pinning you against the advancing edge kills: telegraph it early. Hook:
  `draw()` in `systems/camera.ts`, clamp `cam.scrollX` so it only grows.
- **Moving and crumbling platforms** (M) · Super Mario. A falling platform cracks, drops, vanishes
  and returns in place [MarioFalling]; keep a platform's momentum a few frames after it stops
  [Forgiveness]. Hook: drive moving ones by velocity (an immovable body carries its rider); the
  example's `Terrain.solidAt` in `domain/terrain.ts` reads only the map text, so moving solids need their own check.
- **Collectibles and secrets** (S, example has it) · Celeste strawberries. A berry counts only once
  you land safely and returns if you die first; put them off the main path [CelesteFirst]. The
  deeper a secret is buried, the more interesting it gets [AnimalWell]. Hook: copy `collect()` in
  `domain/run.ts`. The pickups are built in `entities/pickups.ts` (`o` and `*` in `map.txt`).
- **Checkpoints** (S, example has it) · Celeste. Respawn near instantly, never repeat a cleared
  section [CelesteFirst]. Hook: copy `pass()` and `hurt()` in `domain/run.ts` and their handlers in `levels/reactions.ts`; put one before each hard part.
- **Boss with patterns** (L) · Castlevania. A fixed, learnable pattern with cool-downs between
  attacks that leave it open [Bosses]; signal each attack the same way all fight. Split: walks and
  telegraphs; one attack hurts; a second phase; a health bar. Expose `state` and `hp` for tests.
- **Time trial** (S) · Celeste speedruns. A clock from the door opening to the win, best time
  saved (see Save and load).

## Metroidvania

A v1 is one ability that opens one gated door.

- **Ability gating** (M) · Blasphemous 2. Abilities double as keys: one weapon rings bells, one
  breaks barriers [Blasphemous2]. An unusual tool makes an old room new; Animal Well skips the
  standard double jump and dash on purpose [AnimalWell]. Pair with Dash or Double jump.
- **Rooms and a map** (M) · Prince of Persia: The Lost Crown. Memory Shards pin a screenshot of a
  blocked spot to the map so the player need not remember it [MemoryShards]; distinct large rooms
  give each area its identity [SotN]. Hook: `cam.setBounds` to the current room; the map is a scene
  launched on top with `scene.launch` and `scene.pause`.
- **Save points** (S) · Blasphemous 2. Dying respawns enemies and costs a little power you win back
  where you died, not your money [Blasphemous2]. Hook: the checkpoint plus Save and load.

## Puzzle

Turn-based grids are the easiest for an agent to test: the state is a small array.

- **Sokoban with undo** (M) · Sokoban. Push, never pull; `z` undoes, `r` restarts. Undo restores no
  better score and with nothing to undo it does nothing [NEUSokoban]. Moves are grid steps on key
  presses, never physics; the `map.txt` format works as is.
- **Switches and doors** (S) · Portal. Pair a simple element with a clue, since pure on/off
  switches invite trial and error [PuzzleDesign]; introduce one new element at a time and point at
  it [Portal]. Show the state: a lit plate, a visibly open door.
- **Timed levers** (S) · Prince of Persia. A room that is timed must not also teach a new concept:
  split it [Portal].
- **Falling blocks** (M) · Tetris. A 10 x 20 field, pieces from a shuffled bag of seven, a ghost
  piece, a lock delay of 0.5 s [Tetris]. Hook: a board `Int8Array`, gravity on `time.addEvent`.
- **Rule-changing puzzles** (L) · Baba Is You. The words of each rule are pushable blocks; start
  from one word interaction and hunt the unintended solutions [Baba]. Builds on Sokoban.

## RPG

A v1 is one fight against one enemy.

- **Turn-based combat with timed hits** (L) · Sea of Stars. Timed hits are small bonuses, never
  requirements [SoSGamingTrend]; locks on a charging enemy break with matching damage types and
  cancel the move when all break [SoSRPGFan]. Split: turns and HP; timed hits; locks. Hook: a
  `battle` scene launched with the overworld paused; judge timing on `this.time.now`.
- **Overworld** (M) · Chrono Trigger. Visible enemies, not random encounters, let players choose
  their fights [RandomEncounter]. Hook: the starter's square is already a top-down mover.
- **Dialogue with choices** (S) · Forgotton Anne. Branch and merge, short lines, since every branch
  is content only some players see [ForgottonAnne]; advance on a key press [GAGBasic].

## Other genres

- **Endless runner** (S) · Chrome's dinosaur. One speed variable raised in steps and capped; every
  generated gap passable at the current speed; obstacles from a pool.
- **Shoot 'em up** (M) · R-Type. A hitbox far smaller than the ship (`body.setSize`), bullets
  from a pooled group with `maxSize`.
- **Top-down adventure** (M) · The Legend of Zelda. Invulnerable for a moment after a hit, the
  sword a small hitbox alive only during the swing, a door slides the view to the next room
  [CS50Zelda].
- **Rhythm** (M) · Crypt of the NecroDancer. Take time from `AudioContext.currentTime`, never
  from frame times or timers [AudioClock]; each note resolves once, so ignore key repeats. Hook:
  `examples/present/systems/sound.ts` already schedules on one `AudioContext`.
- **Roguelite rooms** (L) · The Binding of Isaac. Generate a floor plan on a small grid, then fill
  each room from handmade layouts, the boss in a dead end far from the start [Isaac]; death moves you
  forward with something kept [Hades]. Seed the generator so a test can replay a plan.
- **Simple racing** (M) · Mario Kart. A lap counts only with checkpoints passed in order, and the
  last one is where you respawn [MKWCheckpoint]; a catch-up rule gives leader and chasers choices
  [RubberBand].

## Any genre

- **Score and rank** (S, example has it). Kills chained before landing count more, the win adds
  what the run collected and shows a letter rank, and the best score is kept like the best time.
  Hook: `POINTS` and `rank()` in `examples/present/domain/score.ts`, `arrive()` in `examples/present/domain/run.ts`.
- **Save and load** (S). `localStorage` throws where storage is blocked [MDNStorage]: copy the
  `muted` pattern in `examples/present/systems/sound.ts`, one key, compared to `"1"`, `try`/`catch`.
- **Assist options** (S each) · Celeste, The Lost Crown. Game speed, invincibility, wider timing
  windows, shake off, high contrast [GAGCeleste] [PoPAccess]. Hook: Arcade's
  `physics.world.timeScale` is inverted (2 is half speed) while `time` and `tweens` are not.
- **Touch controls** (S, example has it). Large, well spaced [GAGBasic]; a floating stick where the
  thumb lands on the left half [Joystick]. Hook: copy `Touch.add()` from `ui/touch.ts` and `Bands.ui()` from `ui/bands.ts`,
  with the `#pad`, `#above` and `#below` elements and their CSS from `examples/present/index.html`,
  which they look up; buttons write into the wizard's `pad` (`setPad()` in `entities/wizard.ts`), which his step reads beside the keys.
- **Tiled levels** (M). Draw in the free Tiled editor; object layers carry spawns and triggers
  [PhaserObjectLayer]. Only when the person wants to draw: `map.txt` is enough for one level.
- **Scene transitions** (S, example has it). Copy `flyIntoDoor()` from `shell/title/door.ts`; overlays use
  `scene.launch` and `scene.pause`, never a restart.

## Sources

[Celeste]: https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs
[Forgiveness]: https://maddymakesgames.com/articles/celeste_and_forgiveness/index.html
[SGnG]: https://www.gamedeveloper.com/design/a-game-analysis-super-ghouls-n-ghosts-or-the-double-jump-done-right-
[GamesBeat]: https://gamesbeat.com/its-the-little-things-never-turning-back-in-super-mario-bros/
[Keren]: https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers
[MarioFalling]: https://mariowiki.com/Falling_Platform
[CelesteFirst]: https://metagearsolid.org/2018/03/first-impressions-celeste/
[AnimalWell]: https://www.nintendolife.com/features/i-avoided-almost-all-the-existing-tropes-peeling-back-the-layers-of-animal-well
[Bosses]: https://www.gamedeveloper.com/design/the-evolution-of-boss-designs-in-video-games
[Blasphemous2]: https://www.shacknews.com/article/136670/blasphemous-2-review-score
[MemoryShards]: https://kotaku.com/prince-persia-lost-crown-memory-shard-screenshot-1851159804
[SotN]: https://www.gamedeveloper.com/design/economy-and-thematic-structure-symphony-of-the-night-s-level-design
[NEUSokoban]: https://course.ccs.neu.edu/cs2500accelf20/ps9.html
[PuzzleDesign]: https://www.gamedeveloper.com/design/designing-video-game-puzzles
[Portal]: https://theportalwiki.com/wiki/Portal_developer_commentary
[Tetris]: https://tetris.wiki/Tetris_Guideline
[Baba]: https://www.gamedeveloper.com/business/road-to-the-igf-hempuli-oy-s-i-baba-is-you-i-
[SoSGamingTrend]: https://gamingtrend.com/reviews/sea-of-stars-review-a-solstice-celebration/
[SoSRPGFan]: https://www.rpgfan.com/review/sea-of-stars/
[RandomEncounter]: https://en.wikipedia.org/wiki/Random_encounter
[ForgottonAnne]: https://www.throughlinegames.com/single-post/2017/09/01/Taming-the-Dialogue-of-Forgotton-Anne
[CS50Zelda]: https://cs50.harvard.edu/games/2018/notes/5/
[AudioClock]: https://web.dev/articles/audio-scheduling
[Isaac]: https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/
[Hades]: https://geekdad.com/2019/10/narrative-and-early-access-supergiants-greg-kasavin-discusses-hades-development/
[MKWCheckpoint]: https://wiki.mkwtas.com/wiki/Checkpoint
[RubberBand]: https://lawofgamedesign.com/2014/08/25/theory-rubber-bands/
[MDNStorage]: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
[GAGCeleste]: https://gameaccessibilityguidelines.com/celeste-assist-mode
[GAGBasic]: https://gameaccessibilityguidelines.com/basic/
[PoPAccess]: https://caniplaythat.com/2024/01/05/ubisoft-shows-off-more-accessibility-of-prince-of-persia-the-lost-crown/
[Joystick]: https://phaser.io/news/2025/12/i-built-the-best-virtual-joystick-for-phaserjs
[PhaserObjectLayer]: https://docs.phaser.io/api-documentation/class/tilemaps-objectlayer
