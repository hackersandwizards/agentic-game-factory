# Polish

For a quest that makes the shared game look and feel better. One technique per quest, judged on a
before and after screenshot of the same scene. The person's canvas is set in the game's `main.ts`; the
example's canvas and art grid are in `CLAUDE.md` ("Art and sound") and
`.claude/rules/high-resolution.md`.

## One grid

Keep every layer on one pixel grid; depth comes from detail, contrast, saturation and haze, never
from a different pixel size. Animal Well draws everything at 320x180 and gets its richness from
light, smoke and procedural animation [AnimalWellSED] [AnimalWell]; Octopath Traveler's makers found that more
resolution cost the pixel-art look [HD2D].

## Readability

- The background dims during big moves, so the action reads [LostCrown].
- A rim of light separates the character from the background [Belmont].
- Reserve one colour for danger and use it nowhere else [WellDweller].
- Saturated colour can carry the art direction [DeadCells].

## Feel

From Celeste's player code [Celeste]: a 50 ms freeze when a dash starts, a 0.2 s shake in the
dash's direction, colour on the character that shows its state (the hair shows the dash), squash and
stretch. The camera smooths, looks ahead and settles on the platform you stand on [Keren].

## Cheap techniques in Phaser 4

The phone cost is judgement from the research, not measurement: check it with `tests/perf.spec.ts`.

| Technique                                                         | Phone cost                |
| ----------------------------------------------------------------- | ------------------------- |
| Hit flash: `setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)` | free                      |
| Foreground occluders, pre-blurred, `setScrollFactor` about 1.4    | free                      |
| Fog bands as stepped gradient strips                              | low                       |
| Light mask: a grid-sized RenderTexture drawn with MULTIPLY        | low                       |
| Afterimages and shockwave rings from a pool                       | low                       |
| Particles, always with `maxAliveParticles`                        | low                       |
| Lighting component (`maxLights`), breaks batching                 | moderate to high          |
| Bloom (`Phaser.Actions.AddEffectBloom`), several full passes      | desktop only              |
| Displacement, camera-wide ColorMatrix or GradientMap              | avoid: a full-screen pass |

Read `node_modules/phaser/skills/filters-and-postfx/SKILL.md` before any filter.

## Sources

[AnimalWellSED]: https://softwareengineeringdaily.com/wp-content/uploads/2024/05/SED1694-Animal-Well.txt
[AnimalWell]: https://www.gamedeveloper.com/art/animal-well-s-haunting-style-owes-much-to-procedural-animation
[HD2D]: https://www.siliconera.com/project-octopath-traveler-developers-answer-project-started-troubles-developing-hd-2d/
[LostCrown]: https://www.theouterhaven.net/prince-of-persia-the-lost-crown-review/
[Belmont]: https://news.xbox.com/en-us/2026/10/14/castlevania-belmonts-curse-legacy/
[WellDweller]: https://www.noobfeed.com/reviews/well-dweller-review
[DeadCells]: https://gonintendo.com/stories/306140-dead-cells-dev-blog-art-design-deep-dive-giving-back-colors-to
[Celeste]: https://github.com/NoelFB/Celeste/blob/master/Source/Player/Player.cs
[Keren]: https://www.gamedeveloper.com/design/scroll-back-the-theory-and-practice-of-cameras-in-side-scrollers
