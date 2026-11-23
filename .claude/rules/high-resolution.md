---
paths:
  - "src/**"
  - "examples/**"
  - "studio/**"
---

# High resolution

What the research before the example's high-resolution port found (October 2026):

- Canvas (set up as in `CLAUDE.md`, "Art and sound"): `smoothPixelArt` keeps the art pixels square with
  antialiased edges at any scale, where `pixelArt` looks even only at whole-number scales. Text stays
  legible at integer positions with origin 0. Source: the installed
  `node_modules/phaser/docs/Phaser 4 Pixel Art Guide`.
- Textures: keep each texture, atlas pages included, at 2048x2048 or less; 4096 works on about 99%
  of WebGL devices and 2048 on all, and a texture's GPU memory is width x height x 4 bytes whatever
  its file size
  ([webglfundamentals](https://webglfundamentals.org/webgl/lessons/webgl-cross-platform-issues.html)).
  Pack sprites into atlases at art-grid size, so a page holds many frames and scaling happens on
  the GPU. Ship pixel art as lossless WebP (`cwebp -lossless -exact -z 9`, the example's 960x540 title
  picture is 236 kB); GPU-compressed formats (ASTC, ETC2) save memory but not download size
  (`node_modules/phaser/docs/WebGL Compressed Textures`).
- Movement: scaling the world scales every distance, speed, acceleration and pixel-measured
  tolerance by the same factor; times (coyote time, jump buffer) stay. Parallax layers use
  `setScrollFactor` below 1 and repeat horizontally with `TileSprite`.
- Grid: 960x540, 2 screen pixels per art pixel; why, measured at five grids: `docs/res-matrix.md`.
- Replacing or regenerating art: capture the same scenes in the previous build and the new one side
  by side, and ship only if the new one is at least as good on depth, light, particles and palette.
