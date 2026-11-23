---
name: studio
description: Make a trailer video for your game, or a greeting video on your own pixel-art workshop picture, with the `studio/` folder (HyperFrames). Use for "make a video", "greeting video", "trailer", "studio", "workshop picture", "paint a slot", "clean up AI pixel art".
---

# Studio

Answer in the language the person writes in. `studio/` makes a game trailer by default; the greeting
mode makes a personalised video greeting for a team or group on the workshop picture. It has its own `package.json`, so the game's install and bundle never see it. Work
inside `studio/` and run every command from there.

Needs Bun and ffmpeg (HyperFrames renders in a headless Chrome it finds or downloads itself); the game art (4b) also needs `cwebp`. Only the image
generation steps need the Codex CLI with a Codex login (`codex login`); say so before such a step,
and when the person has no login, skip it: every other step works without.

## 1. Trailer (default)

```sh
cd studio && bun install && bun run trailer
```

Done when `renders/trailer.mp4` (1920x1080, 24 s plus a 2 s hold: title card, gameplay clip, end card
with URL and QR code, sound mastered by `scripts/master.mjs`) and its last frame `renders/trailer.png` exist. Look at the poster and a frame
(`ffmpeg -ss 10 -i renders/trailer.mp4 -frames:v 1 renders/frame.png`) as images.

The four variables `title`, `tagline`, `url` and `endLine` are the `data-composition-variables` of
`trailer/index.html`: change their defaults there. Without their own files, the render uses the
example's `../docs/gameplay.mp4` and `../docs/title.png`, copied into `trailer/assets/` whenever one is
newer than its copy. For their game, put their own clip at `trailer/assets/clip.mp4` and their title
screen at `trailer/assets/title.png`: a file put there stays until its `../docs/` file changes. Record the clip by
playing the game in a browser with a screen recorder, or headless with Playwright's `recordVideo`
(no sound); `data-media-start` on the `<video>` sets where in the clip the trailer cuts in. A
`<video>` in the composition without sound needs `data-has-audio="false"`.

## 2. Greeting (optional)

A personalised video greeting for one team or group: the wizard walks through the places you
worked together, meets the people there, wins over a boss and ends on your game's title. Beispiel
GmbH, a fictional company, is the sample (`greeting/customers/beispiel-gmbh.json`); render it
first to see what the fields do. The trailer needs none of this section.

What a newcomer needs first: the sample renders as it is. For your own group you need the facts
of the year (places, dates, people), and Codex only if you want painted art of your own (§3). The
field names below are the ones the code reads; "customer" in a file or flag name means the group
you greet, and a "trainer" is a person the wizard meets at a stop.

```sh
bun run greeting beispiel-gmbh
```

Done when `renders/beispiel-gmbh.mp4` (1920x1080, a 2 s hold on the last frame, sound
mastered to -14 LUFS, picture re-encoded once at CRF 24 with `+faststart` by `scripts/master.mjs`) and its poster
`renders/beispiel-gmbh.png` (1920x1260: the whole workshop at 62.6 s, the greeting band from frame 0
under it; the outro's timing and that time change together) exist. The render first writes the chiptune score for that group
(`scripts/score.mjs`, its cue times mirror the composition's timing: change both together). A team
name too long for its gift tag stops the render: shorten it. The film is always 80.17 s: one to four
stops share the same room time, a room in two places with two people three beats more.

You personalise it, not a script: every content choice below is yours, and the scripts only
compose, render, master and check. A fix one group's render needs goes into the engine only where it
also holds for Beispiel GmbH. In order, each step done when its check holds:

1. **Facts.** Read who the video greets and what happened from the person or their records:
   - one to four stops, each a place you met (`stopNPlace`), the backdrop it stands on
     (`stopNLandmark`), its dates and what happened there (`stopNQuest`), one or two people the
     wizard meets (`stopNNpc1`, `stopNNpc2`, each wearing a look from `trainerLooks`), and a line for each person who
     speaks: every stop needs `stopNLine`, and a room in two places with two people also
     `stopNLine2`; the render stops otherwise;
   - the `questLog`, the dated list of what happened, shown beside the map, and the map's
     `places`, plus up to two side places (`sideN*`, a place without an event, such as a home
     town);
   - the group's name `customerName`, the send date `asOf`, the gift-tag `teams`, the boss (`bossName`) and its line (`bossLine`), the `greeting`, the `nod`
     (a personal line on the end card), the terminal lines `screenScript`, the `doorTitle`, and the end card's
     `kitLine`, which says what the link opens. The QR code on the title strip, under the `scanLine` call to the last frame,
     encodes `kitUrl`, by default the playable game at
     `https://hackersandwizards.github.io/agentic-game-factory/examples/present/`. The end card sits beside the wizard with every line at the
     phone minimum, so a customerName, greeting, nod or kitLine too long for it stops the render: shorten it.

   Write only what a source settles; leave the rest out and tell the person. Done when every stop
   has a source.

2. **Data.** Copy only `greeting/customers/beispiel-gmbh.json` to `<name>.json` in a customers
   folder (`greeting/customers/` by default, which git ignores apart from the sample) and make
   `<name>/` beside it for their own art; Beispiel's `I1.png` is the sample's, not theirs. Set
   `"slots": "{}"` until step 3 paints a fill (a slot is a painted region of the workshop picture,
   named by its id in `greeting/slots.json`, such as `I1`); compose rewrites `hubImage`, `hubMask`
   and `hubLayout` (where the picture's labels sit) itself. Write every key from step 1: the keys
   are the composition's variables, described in the `data-composition-variables` attribute of
   `greeting/index.html`. Keep a real group's folder outside this repo, which is public, and render
   with `bun run greeting <name> --customers <absolute dir>` (or `GREETING_CUSTOMERS=<dir>`): every path
   in the JSON is relative to the folder. Done when the JSON parses.
3. **Art.** Paint each slot fill, backdrop, easter egg or boss the group gets with Codex (§3), name
   it in the JSON, and run `bun scripts/workshop.mjs compose <name>` (with `GREETING_CUSTOMERS` for
   an outside folder). Done when you have looked at the composed `<name>/workshop.png`.
4. **Render** with `bun run greeting <name>`, then run the visual check (§7).

`language` (`de` or `en`) sets the film's own words, and in English every text left at its default
takes its English default; write the group's own texts in that language
(`greeting/customers/beispiel-gmbh-en.json` is the English sample). An English version shares the
German version's art folder (`slots` paths) and gets its own composed pictures in `<name>-en/`. An empty `stopNPlace`
drops that stop. Rooms, map and boss stand on painted backdrops (960x540, walkway edge at row 417).
The factory's three show real places: `harbor` is Hamburg, `city` Berlin, `alps` an alpine lake town;
use one only for that kind of place, and paint the group's own otherwise: attach the factory
backdrop nearest in kind as `reference.png`, ask Codex for the same framing, palette, pixel size and
walkway edge with their landmark behind it and no text, then crop it to 16:9 with the
walkway edge at 77 % of the height (417 of 540) and scale it to 960x540: `mkdir -p
greeting/customers/<name>/backdrops && ffmpeg -i cx/result.png -vf
"crop=iw:iw*9/16:0:<top>,scale=960:540:flags=area" greeting/customers/<name>/backdrops/<place>.png`,
where `<top>` is the walkway edge's row in `cx/result.png` minus 0.77 of the crop height (no
`pixelate.mjs`: the backdrops are not on a coarse grid). Name `<name>/backdrops/<place>.png` in
`stopNLandmark` and look at it: the walkway edge sits at row 417. The people wear one of the fourteen generic looks in
`greeting/assets/sprites/people.png`: pick one per person in `trainerLooks` from the look list in
its description (a person without a look, or two sharing one, stops the render). The boss is the factory's `monolith` unless `bossArt` describes their own, and `eggs` lists
their easter eggs: art that points at the group stays in their folder, never in this repo or its history.

## 3. Greeting: their workshop picture

The picture is one frozen base, `greeting/assets/workshop-film.png` (the game's title picture
`workshop-hw.png` with the belt's gifts lifted into `belt-gifts.png`), plus painted slot fills. It stays the
layout reference, while the greeting shows the `-960` versions.
`greeting/slots.json` lists the slots in image pixels, each with what it is. To paint one (Codex):

```sh
mkdir -p cx greeting/customers/<name>
bun scripts/workshop.mjs crop I1 cx/reference.png
cat prompts/slot-edit.txt prompts/change-sled.txt > cx/prompt.txt   # their change goes in cx/, not prompts/
codex exec --skip-git-repo-check --ephemeral -s workspace-write -C cx -i cx/reference.png - < cx/prompt.txt
bun scripts/workshop.mjs cut I1 cx/result.png greeting/customers/<name>/I1.png --shadow --only 980,820,155,85
```

Each slot's `holds` in `greeting/slots.json` says what the base already shows there: an edit
replaces or joins that. The generator also shifts things it was told to keep, so pass `--only` with
the image box (x,y,w,h) of the change you asked for, and `cut` keeps nothing outside it.

Then name the fill in their `slots` (a JSON string): `{"I1":{"paint":"<name>/I1.png"}}`, with
`"text"` for a slot that carries a label. `bun run greeting <name>` composes the picture first. The
other `prompts/change-*.txt` and `prompts/moustache.txt` are the edits h&w made to its own base.

A whole new base: `prompts/base.txt` is the prompt h&w used (attach a style reference and their
mascot with `-i`). Run its result through step 4, write the magenta twin (every blank filled
`#FF00FF`, the prompt asks for it), find the blanks with `bun scripts/detect-blanks.mjs <twin.png>`,
and write their boxes into `greeting/slots.json`. `bun scripts/workshop.mjs layout` prints the bare
base's `hubLayout`, the composition's default.

Generated images hold no text and no logos. Every word and logo is an overlay: drawn on the art's
native pixel grid, quantised to the art's palette and lit like the scene, in cream and dark-brown
ink. Never paste vector text or a vector logo onto the picture.

## 4. Clean up AI pixel art

Generated "pixel art" paints soft blocks off any grid. Turn it into real pixel art:

```sh
bun scripts/pixelate.mjs raw.png clean.png --colors 32               # a background or scene
bun scripts/pixelate.mjs raw.png sprite.png --colors 16 --key 00FF00 # a sprite on a green screen
```

It finds the block size, takes one pixel per block, reduces the palette without dithering and,
with `--key`, makes the background fully transparent with hard edges. Done when it prints the cell
size and the output's pixel size. When it finds no grid, pass `--cell <block size in px>`, read off
a zoomed crop. A sprite or background for the game goes into the game's assets afterwards.

Animated sprites stay consistent when every frame is painted against the same reference (one
sheet per character, one row of equal frames, a fixed canvas and a shared feet baseline), on a flat
green or magenta screen, and every frame runs through the same `pixelate.mjs` call with the same
`--colors`, so the palette locks across the sheet. Where frames still drift, ship fewer frames and
animate with squash, stretch and tweens instead of shipping flicker. That is how the example's sheets
were made (4b). Their generated blocks came out soft and off any grid, so the grid snap is never
optional.

## 4b. Game art

The example game's art is generated, never hand-placed: `game-art/<name>.webp` are the Codex
outputs, `prompts/game/<name>.txt` the prompts that made them (each starts with
`prompts/game/style.txt`; attach `greeting/assets/workshop-hw.png` as `reference.png`, plus
`game-art/hero.webp` as `hero.png` for every sprite sheet after the hero, so all share its pixel
size). One run per file:

```sh
mkdir -p cx && cat prompts/game/style.txt prompts/game/hero.txt > cx/prompt.txt
codex exec --skip-git-repo-check --ephemeral -s workspace-write -C cx -i cx/reference.png -i cx/hero.png - < cx/prompt.txt
```

Store a kept result as `cwebp -q 95 -m 6 cx/<name>.png -o game-art/<name>.webp`, set its grid cell
in the table in `scripts/game-art.mjs`, then run
`bun scripts/game-art.mjs`: it snaps every source to its grid, locks all of them to one palette,
cuts the sheets into frames (`scripts/sheet.mjs`) and writes the tiles, one sprite atlas into
`../examples/present/assets/`, then the background layers, one scroll period each on the game's
art grid (its size and why: `.claude/rules/high-resolution.md`). Their sources (`sky`, `mountains`,
`forest`, `near`) came from the one prompt in `prompts/game/layers.txt` and were repainted finer
with `prompts/game/layer.txt` (the first result attached as `layout.png`); the build scales each to
the art grid without a grid snap, maps it to a few colours of its own plus its warm lights' and
clears its one-pixel speckle, so it is pixel art on the hero's grid with less detail than him;
`foreground` (`prompts/game/foreground.txt`) is the occluder in front of the play plane, built the
same way at 8 colours; `valley`, what the game shows under the mountains when the camera climbs high, has no source:
the build draws it from the mountains layer, sinking into mist and night. Done when it prints the atlas size.
Size every sheet against the hero: each sprite sheet after the hero draws the wizard first, and its cell is
the wizard's height in source pixels over 81 art pixels (the hero himself is drawn 94 tall); the build clears him
before cutting; the tiles' cell is a tile's width in source pixels over 48. The generator paints coarser blocks than the prompt asks for (asked for 4 source pixels, it painted
5.5 to 10), so a sheet drawn small comes out coarse: ask for the row as large as the image allows. Check
a tile or a layer's loop by laying two copies side by side.

## 5. Greeting: end on their game's title

The film ends on `workshop-hw-960.png` at 2x with the title texts on it: `GAME` in
`greeting/index.html` (search for "The game's title screen") holds the game-pixel positions of the
level board, the PRESS START board and the staff glow. Match them to their title
scene. When the game's title shows another picture, put it at `greeting/assets/workshop-hw.png` and
give the film and the game the same pixels:

```sh
bun scripts/workshop.mjs snap greeting/assets/workshop-hw.png greeting/assets/workshop-hw-960.png
cwebp -lossless -exact -z 9 greeting/assets/workshop-hw-960.png -o <game assets>/workshop.webp
```

Done when the last frame of the render shows the same screen as the game's title.

## 6. Render and check

`bun run check` tests the mastering on clips with and without sound, builds the trailer inputs, writes the sample's score and lints both compositions. `bun run trailer` and `bun run greeting <name>` write
`renders/` and a poster.

## 7. Greeting: visual check

Nothing ships with a finding open. Fix each in the fill, the data or the engine it comes from, then
look again.

- The picture: tile `<name>/workshop.png` into twelve crops at 2x
  (`for j in 0 1 2; do for i in 0 1 2 3; do ffmpeg -v error -y -i <name>/workshop.png -vf "crop=418:313:$((i*418)):$((j*313)),scale=iw*2:ih*2:flags=neighbor" renders/t$j$i.png; done; done`)
  and read every crop. Look at each slot box's boundary and each object touching a box or frame
  edge for hard seams, mismatched texture, clipped or floating objects, holes and stray pixels.
  A `cut` warning about a box edge is such a seam.
- The film: a frame sheet (`ffmpeg -v error -i renders/<name>.mp4 -vf fps=1/2,scale=480:-1,tile=5x8 renders/sheet.png`)
  plus a full-size frame of every room, the map, the boss and the last frame. Read every text at
  1x for spelling, language and legibility; look for overlaps, labels outside 96 px of the frame's
  sides, and labels or bubbles crossing during a fade.
