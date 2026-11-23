// Plays a page of this repo in a real browser and saves a screenshot after every step.
// Usage: bun .claude/skills/playtest/playtest.mjs [--out=DIR] [--url=URL] [--viewport=WxH] [--cover] [page] [step ...]
//   DIR   where the screenshots go, its earlier NN-step.png shots deleted first (default playtest/)
//   URL   a server already running, such as a vite preview (default: its own dev server)
//   WxH   --viewport=WxH, the page size in CSS px (default 960x540)
//   --cover  also saves the canvas after the last step as the game's cover.webp, 640x360: its picture on the root page
//   page  "/starter/" (the starter, default), "/examples/<game-name>/" (a game)
//   step  wait:MS | KEY | KEY:MS | KEY+KEY:MS   (KEY is a Playwright key name: ArrowRight, Space, KeyR ...)
// Example: bun .claude/skills/playtest/playtest.mjs /examples/present/ ArrowRight:600 Space wait:500
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { launchOptions } from "../../../tests/chrome.ts";

const args = process.argv.slice(2);
const flag = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
// The page is the first argument only when it starts with "/"; otherwise every argument is a step.
const positional = args.filter((arg) => !arg.startsWith("--"));
const path = positional[0]?.startsWith("/") ? positional.shift() : "/starter/";
const steps = positional;
// Every step is checked before the browser starts, so a typo costs no run.
const bad = steps.find((step) => !/^(wait:\d+|\w+(\+\w+)*(:\d+)?)$/.test(step));
if (bad) {
  console.error(`Bad step "${bad}": use wait:MS, KEY, KEY:MS or KEY+KEY:MS`);
  process.exit(2);
}
const cover = args.includes("--cover");
if (cover && !/^\/examples\/[^/]+\/$/.test(path)) {
  console.error("--cover needs a game's page: /examples/<game-name>/");
  process.exit(2);
}
const out = flag("out") ?? "playtest";
const base = flag("url");
const [width, height] = (flag("viewport") ?? "960x540").split("x").map(Number);
// Only this script's own shots go, so a wrong --out (.., /, a home folder) deletes nothing else.
mkdirSync(out, { recursive: true });
for (const file of readdirSync(out)) if (/^\d{2,}-[\w+-]*\.png$/.test(file)) rmSync(`${out}/${file}`);

const server = base ? undefined : await createServer({ logLevel: "silent" });
await server?.listen();
const url = new URL(path, base ?? server.resolvedUrls.local[0]).href;
const browser = await chromium.launch({ ...launchOptions, headless: true });
const page = await browser.newPage({ viewport: { width, height } });
const errors = [];
page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
page.on("pageerror", (error) => errors.push(error.message));

const shots = [];
const shoot = async (name) => {
  const file = `${out}/${String(shots.length + 1).padStart(2, "0")}-${name.replace(/[^\w+-]/g, "_")}.png`;
  await page.locator("canvas").screenshot({ path: file });
  shots.push(file);
};

await page.goto(url);
await page.waitForSelector("canvas");
await page.waitForTimeout(800);
await shoot("start");
for (const step of steps) {
  const [keys, ms = "0"] = step.split(":");
  if (keys === "wait") {
    await page.waitForTimeout(Number(ms));
  } else {
    for (const key of keys.split("+")) await page.keyboard.down(key);
    await page.waitForTimeout(Math.max(Number(ms), 50));
    for (const key of keys.split("+").reverse()) await page.keyboard.up(key);
    await page.waitForTimeout(150);
  }
  await shoot(step);
}

if (cover) {
  const png = (await page.locator("canvas").screenshot()).toString("base64");
  const webp = await page.evaluate(async (data) => {
    const shot = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(640, 360);
    // Fills 16:9 from the centre, whatever shape the game's canvas has.
    const scale = Math.max(640 / shot.width, 360 / shot.height);
    const [w, h] = [shot.width * scale, shot.height * scale];
    canvas.getContext("2d").drawImage(shot, (640 - w) / 2, (360 - h) / 2, w, h);
    const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.8 });
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(blob);
    });
  }, png);
  writeFileSync(`.${path}cover.webp`, Buffer.from(webp, "base64"));
  shots.push(`.${path}cover.webp`);
}

await browser.close();
await server?.close();
console.log(`Played ${url}\nScreenshots:\n${shots.map((s) => `  ${s}`).join("\n")}`);
console.log(
  errors.length ? `Console errors:\n${errors.map((e) => `  ${e}`).join("\n")}` : "Console errors: none",
);
process.exit(errors.length ? 1 : 0);
