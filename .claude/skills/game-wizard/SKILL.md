---
name: game-wizard
description: Finds the person's game with them before any code is written, through a short interview, web research into reference games, 3 to 5 tiny pitches from a mechanics menu and a scope cut, then starts the game's folder with its GAME.md and hands over to quest. Use when the person has no game yet, or for "start", "game wizard", "what game should I build", "I have no idea", "new game idea", "add a mechanic", "start over".
---

# Game wizard

The goal is a game small enough to finish in the evenings the person has, which they want to play
themselves. You research and propose; the person
picks. Name the habit while you use it: this skill practises research before code and a written
plan a fresh session can continue from.

If the person's `examples/<game-name>/GAME.md` exists, ask whether to replace it, add a mechanic, or continue with `quest`. To add
one, offer three from [mechanics.md](mechanics.md) that fit `GAME.md` and append the chosen one as
quests as step 5 says, then commit. Continue below only when the person says replace.

## 1. Interview

Ask in one message, with an example answer for each so a short reply is enough:

1. Which games do you love playing, or loved as a kid? (Two or three titles.)
2. What mood should yours have: cosy, frantic, spooky, funny, clever?
3. How many evenings do you have for it?
4. Who builds and plays: you alone, or with a child (how old)?
5. Keyboard, touch (phone or tablet), or both?
6. How often do you work with a coding agent such as Claude Code or Codex: never, now and then, or
   every day?

Where the person answers "no idea" or "surprise me", take the defaults and say so: the example's
platformer as the loved game, cosy, two evenings, solo, keyboard, never. Done when every question has an
answer or a named default.

## 2. Research

Before the first search, tell the person in one line that you now research on the web and that
their agent may ask them to allow each search or page. Run four to eight searches built from the
answers, for example:

- the core mechanic of each loved game (`"<game>" core mechanic game design`),
- small games that already do it: game-jam entries on itch.io are the right size
  (`itch.io jam <genre> one screen`), and postmortems of short games,
- for a child: games children of that age enjoy and can control (`games for 9 year olds simple controls`),
- the twist candidates from the ingredient list that fit the mood.

Open at least three pages and read them. Keep for each reference game its name, the URL you read,
and the one thing worth stealing (a mechanic, a feel, a rule), never its art. Never cite a link you
did not open in this session. Where search fails, say so and pitch from the ingredient list and
[mechanics.md](mechanics.md), whose sources are checked, marking your own references as unchecked.
Done when you hold at least five reference games with a URL each.

## 3. Idea board

Show a short board, then the pitches.

The board crosses three columns. Use these ingredients, plus any your research found:

| Genre                                  | Core mechanic                  | Twist                                   |
| -------------------------------------- | ------------------------------ | --------------------------------------- |
| Mario-like platformer                  | jump (variable height, coyote) | a timer: beat it in 60 seconds          |
| top-down Zelda-like (one room)         | sword swing or weapon          | a boss at the end                       |
| puzzle (Sokoban, slide, switch)        | push blocks, flip gravity      | every move costs a turn                 |
| metroidvania (tiny: one gated ability) | dash, double jump, grapple     | the ability you gain opens the way back |
| roguelike (one floor, random)          | shoot, dodge                   | the level reshuffles on every death     |
| endless runner                         | one button                     | speeds up with every point              |
| tower defence (one path)               | place and upgrade              | you are the monsters                    |
| stealth (one guard)                    | vision cones, hide             | light and dark switch                   |
| rhythm                                 | press on the beat              | the music is the level                  |
| physics (throw, stack, balance)        | aim and launch                 | the wind changes                        |
| shoot 'em up                           | weapons and power-ups          | two players on one keyboard             |
| catch or collect (good with children)  | move left and right            | the child drew every sprite             |

Then pitch three to five games. Each pitch has: a title, one sentence (who you play, what you do,
how you win), its genre × mechanic × twist, three reference games with their URLs and what
to steal, three mechanics from [mechanics.md](mechanics.md) with their size and the one you
recommend, and "after one evening you can play: ..." in one sentence. One pitch stays close to the
example (`/examples/present/`, a one-level platformer) because its code is a ready reference. Mix
at least one pitch from outside the person's favourite genre. Done when every pitch has all six
parts.

## 4. Cut the scope

The person picks a pitch or mixes two. Cut it to v1 together:

- one screen or one level, one core mechanic done well, one way to win, one way to lose;
- what one evening looks like: two to three hours hold three or four quests, each a change the
  person can play, such as "the player jumps", "a coin counts up", "touching a spike restarts";
- with a child: sessions of 45 minutes, the child designs characters, names and levels (on paper
  grids the agent turns into sprite text) and plays every quest; the adult drives the keyboard;
- the honest size of big genres: a metroidvania v1 is one ability that opens one gated door, a
  roguelike v1 is one random room, a Zelda-like v1 is one room with a key, a door and one enemy type;
- the base stays minimal: the recommended mechanic is the first quest after "share it", the other
  two go on the cut list.

Everything else goes on the cut list: menus, more levels, save games, multiplayer over the network,
story, settings, online leaderboards, anything that needs a server or an account. Cut items can
return as late quests once the core loop is fun. Done when the person agrees to the v1 and the cut
list.

## 5. Write GAME.md

Create `examples/<game-name>/`, the name kebab-case from the title: copy `starter/index.html` and
`src/main.ts` into it, the page loading `./main.ts`, titled for the game and without what its comment
says to delete, and write `GAME.md` there from the template. The quest plan has 8 to 12 quests:

- Quest 1 is always: the player character moves in their game, replacing the square in
  its `main.ts`.
- The core loop (move, goal, win, lose) is playable by quest 5 at the latest. Every quest leaves the
  game playable.
- The quest right after the core loop is "share it": the game runs from `dist/` on GitHub Pages or
  itch.io. Later quests polish what is shared.
- Count three quests per evening, two with a child, and mark every quest beyond that count
  `(bonus)`. Keep the core loop short enough that "share it" and the recommended mechanic fall
  inside the count.
- Each quest names what the player sees and a "Done when" a screenshot or a test can check.
- Each mechanic added after the core loop is its own quest, an L mechanic two or three, with a test
  in its "Done when". Its line carries the rules and source link from `mechanics.md`, and the hook
  where the game shares the example's genre.

```markdown
# <Game title>

<Pitch: one sentence, who you play, what you do, how you win.>

Built by <who> on <n> evenings. Input: <keyboard / touch / both>. Works with a coding agent: <answer to question 6>.

## Reference games

- [<Game>](URL): steal <the one thing>.
- [<Game>](URL): steal <the one thing>.
- [<Game>](URL): steal <the one thing>.

## Core loop

<Three to five steps the player repeats, e.g. explore the room, find the key, avoid the bat, open the door.>

## Controls

<Each key or touch gesture and what it does.>

## Art direction

<Palette (three to six colours), sprite size, mood, sound. Canvas: the 320x180 of `main.ts`
unless the person wants the example's (CLAUDE.md "Art and sound"). Drawn in code or own work, CC0
otherwise; nothing taken from the reference games.>

## Not in v1

- <cut item>

## Quests

- [ ] 1. <What the player sees>. Done when: <a check in a screenshot or a test>.
- [ ] 2. ...
```

Show `GAME.md` to the person and adjust it to their answer. Then run `bun run check` (install first
if `node_modules/` is missing; where the tests find no browser, show the person the error: Chrome for Testing
downloads on the first run and needs network access) and commit the folder's three files. Done when `git log -1` shows the commit.

## 6. Hand over

Tell the person the next step: start a fresh conversation (`/clear` in Claude Code, `/new` in
Codex) and run `/quest` (Codex: "Start the quest skill"). It builds quest 1. Stop here.
