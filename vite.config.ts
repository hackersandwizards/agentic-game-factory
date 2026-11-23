import { existsSync, readFileSync, readdirSync } from "node:fs";
import { defineConfig } from "vite";
import BRAND from "./brand.json" with { type: "json" };

// Every game is its own page, examples/<game-name>/index.html. The root page shows each as a tile, its <title> under
// its cover.webp where the folder holds one, read on every request, so a new game shows in dev without a restart.
const games = (root = "examples") =>
  readdirSync(root)
    .map((name) => ({ name, page: `${root}/${name}/index.html` }))
    .filter(({ page }) => existsSync(page))
    .map(({ name, page }) => ({
      page,
      href: `examples/${encodeURIComponent(name)}/`,
      cover: existsSync(`${root}/${name}/cover.webp`),
      title: /<title>([^<]*)<\/title>/.exec(readFileSync(page, "utf8"))?.[1].trim() || name,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "en"));

export const tiles = (root?: string) =>
  games(root)
    .map(
      ({ href, cover, title }) =>
        `<li><a href="${href}">${cover ? `<img src="${href}cover.webp" alt="" width="640" height="360" loading="lazy" />` : ""}<span>${title}</span></a></li>`,
    )
    .join("");

export default defineConfig({
  base: "./",
  // The pages' CSS reads h&w's colours as var(--night) and so on, from the one copy in brand.json.
  plugins: [
    {
      name: "brand",
      transformIndexHtml: {
        // Before Vite reads the page, so the build takes each cover in as an asset.
        order: "pre",
        handler: (html) => ({
          html: html.replace("<!-- games -->", tiles()),
          tags: [
            {
              tag: "style",
              children: `:root{${Object.entries(BRAND.colors)
                .map(([k, v]) => `--${k}:${v}`)
                .join(";")}}`,
              injectTo: "head-prepend",
            },
          ],
        }),
      },
    },
  ],
  // Phaser alone is over 1 MB; a single game file of that size is fine for a game.
  build: {
    chunkSizeWarningLimit: 2000,
    // Phaser's MIT and the font's OFL require their notices to ship with the game.
    license: { fileName: "licenses.md" },
    rolldownOptions: {
      input: ["index.html", "starter/index.html", ...games().map(({ page }) => page)],
    },
  },
});
