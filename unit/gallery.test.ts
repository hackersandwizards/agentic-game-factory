import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { tiles } from "../vite.config";

const root = mkdtempSync(join(tmpdir(), "gallery-"));
afterAll(() => rmSync(root, { recursive: true }));
const game = (name: string, title: string, cover: boolean) => {
  mkdirSync(join(root, name));
  writeFileSync(join(root, name, "index.html"), `<title>${title}</title>`);
  if (cover) writeFileSync(join(root, name, "cover.webp"), "");
};

test("the root page shows a tile per game page, by title: the cover where the folder holds one, else the title alone", () => {
  game("with-cover", "Zebra run", true);
  game("no cover", "Apple fall", false);
  mkdirSync(join(root, "no-page"));
  expect(tiles(root)).toBe(
    '<li><a href="examples/no%20cover/"><span>Apple fall</span></a></li>' +
      '<li><a href="examples/with-cover/"><img src="examples/with-cover/cover.webp" alt="" width="640" height="360" loading="lazy" /><span>Zebra run</span></a></li>',
  );
});
