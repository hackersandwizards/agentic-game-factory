# Art grid matrix, 2026-10-25

Canvas 1920x1080 in every case. Spike: HEAD ca3cc1e with every art texture rescaled from the full-size
sources to the grid (Lanczos, palette 32-128 colours) and drawn at 1/k, autopilot running, 600 frames.
Machine: Apple M3 Max, headless Chrome on ANGLE Metal, load average 8-16 during the runs. Two passes each;
the worse pass is shown. Mobile: 844x390, DPR 3, touch, CDP CPU throttling. Frame p95 came from
animation-frame timestamps and cannot show a slow frame (why: `tests/perf.spec.ts`); busy p95, Phaser's
work per frame, is the column to read.

| grid      | screen px per art px | art kB (+438 title webp)                 | texture MB (+6.0 title) | largest side                             | desktop p95 / busy p95 | mobile 4x p95 / busy | mobile 6x p95 / busy | first frame desk / 4x / 6x |
| --------- | -------------------- | ---------------------------------------- | ----------------------- | ---------------------------------------- | ---------------------- | -------------------- | -------------------- | -------------------------- |
| 480x270   | 4                    | 172                                      | 3.6                     | 1024 (atlas)                             | 16.8 / 1.6 ms          | 16.8 / 4.0 ms        | 16.8 / 6.3 ms        | 170 / 501 / 803 ms         |
| 640x360   | 3                    | 264                                      | 6.4                     | 1365                                     | 16.7 / 1.3             | 16.8 / 3.8           | 16.8 / 5.9           | 171 / 529 / 774            |
| 960x540   | 2                    | 473                                      | 14.4                    | 2048 (atlas)                             | 16.7 / 0.8             | 16.8 / 3.8           | 16.7 / 6.5           | 181 / 547 / 844            |
| 1280x720  | 1.5 (not integer)    | 718                                      | 25.6                    | 2160 (layer)                             | 16.8 / 0.8             | 16.8 / 4.0           | 16.7 / 6.3           | 199 / 562 / 897            |
| 1920x1080 | 1                    | 1270 (sources upscaled, real art larger) | 57.6                    | 3240 (layer), 4096 atlas unless repacked | 16.8 / 0.9             | 16.8 / 4.0           | 16.7 / 8.4           | 221 / 676 / 1100           |

Reading: CPU work per frame does not move with the grid
(same objects, same draw calls; the frame column cannot tell, see above). What grows is texture memory (x16 from 480 to 1920), download and first
frame (+30-40 % at 1920 under 6x). Chrome emulation throttles the CPU only, never the GPU: phone GPU
fill-rate and memory pressure are not measured here; the texture MB column is the proxy.

## Framework facts

- The backing buffer is the game size, 1920x1080, whatever the grid or DPR: measured `canvas.width x
height` = 1920x1080 at DPR 1 and 3. Phaser 4 has no game `resolution` setting; Scale.FIT only sets CSS size
  (node_modules/phaser/skills/scale-and-responsive/SKILL.md, "The zoom affects CSS display size but not
  the canvas resolution"). So fragment work is the same 1920x1080 per layer at every grid: the grid
  changes texels sampled per screen pixel, not pixels shaded.
- Max texture size: `renderer.getMaxTextureSize()` returns `gl.MAX_TEXTURE_SIZE` (phaser.js, WebGLRenderer
  getMaxTextureSize and boot `config.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)`); 16384 here.
  Floor: 100 % of reports >= 4096, Android 74 % >= 8192, iOS 100 % >= 8192
  (https://web3dsurvey.com/webgl/parameters/MAX_TEXTURE_SIZE, fetched 2026-10-25). Safe floor 4096; the
  kit keeps 2048 as its own margin.
- Phaser does not split an oversized texture: only DrawingContexts are clamped to the max size (phaser.js
  DrawingContextPool.get). A TileSprite in v4 wraps NPOT textures itself (phaser.js TileSprite docs:
  "These restrictions have been lifted in v4"), so a layer stays one texture as long as it fits.
- pixelArt = NEAREST filtering, antialias off, roundPixels on; smoothPixelArt = LINEAR plus a shader that
  keeps texels square with soft edges, "only visible when objects are scaled up"; roundPixels snaps
  vertices only when object and camera are unscaled and unrotated (safeAuto)
  (node_modules/phaser/docs/Phaser 4 Pixel Art Guide, "Smooth Pixel Art", "Rounded Pixel Art"). So at
  2, 3, 4 px per art px smoothPixelArt is the right mode; at 1:1 it adds nothing and pixelArt is the
  mode; at 1.5 (1280 grid) texels land 1 or 2 screen pixels wide and flicker in motion (guide, "Pixel
  Flicker").

## Source detail per grid

- Layers (2172x724 per period, painted finer than a sprite, ~2-3 source px per painted block): real detail
  up to ~1280 (2160 per period). 960 is a 0.75 downscale. 1920 needs 3240x1080 per period: regenerate.
  Changed since f3c94b5 (2026-10-26): the layers ship as pixel art on the hero's grid, 1620x540 per period,
  with less detail than him (`studio/scripts/game-art.mjs`).
- Sprites (hero 7.5, bugs 7.75, props 10.85, big props 6.05, tiles 9.75 source px per art px): native at 480. Any higher grid needs regeneration at a finer cell (960: ~3.75 source px per art px, a 88 px hero
  in a 2172x724 sheet, feasible). At 1920 the hero is ~176 px of single pixels: a painted HD sprite, not
  pixel art (the guide: image models "generally" cannot paint true pixel art).
- Title picture 960x540 (`workshop.webp`, lossless): native on the 960 grid; 1920 would upscale it 2x.
  The table's title figures (+438 kB, +6.0 MB) are the 1672x940 picture measured then; the 960x540 one is
  236 kB and 2.1 MB of texture.
- Codex output: the stored sources came out at 2172x724 when asked for the highest resolution. Third-party
  docs give gpt-image-2 up to 3840 px per edge, at most 3:1, "experimental" above 2560x1440
  (help.scenario.com GPT Image 2 essentials; docs.leonardo.ai gpt-image-2); OpenAI's own reference not
  confirmed.

## Decision: 960x540

Highest integer grid with real source detail: every grid passes the frame budget here, 1280 is not an
integer scale, and 1920 needs every source regenerated beyond one Codex image per layer, 58+ MB of
textures, and stops being pixel art. 960 keeps textures <= 2048, ~0.9 MB of art plus the title, and
regenerates only the sprite sheets.
