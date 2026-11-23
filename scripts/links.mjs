import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import MarkdownIt from "markdown-it";
import { defaultTreeAdapter, parse } from "parse5";
import { checkoutFiles } from "./process.mjs";

const markdown = new MarkdownIt({ html: true, linkify: true });
const origin = "https://game.invalid";

/** @typedef {import("parse5").DefaultTreeAdapterTypes.Node} HtmlNode */
/** @param {HtmlNode} node @param {(node: HtmlNode) => void} visit */
function walk(node, visit) {
  visit(node);
  if ("childNodes" in node) for (const child of node.childNodes) walk(child, visit);
  if ("content" in node) walk(node.content, visit);
}

/** @param {HtmlNode} node @returns {string} */
function textOf(node) {
  if (defaultTreeAdapter.isTextNode(node)) return node.value;
  return "childNodes" in node ? node.childNodes.map(textOf).join("") : "";
}

/** @param {string} file */
function scan(file) {
  const source = readFileSync(file, "utf8");
  const isMarkdown = file.endsWith(".md");
  const anchors = new Set();
  /** @type {{url: string, asset: boolean}[]} */
  const links = [];
  if (file.endsWith(".css")) {
    for (const [, url] of source.matchAll(/url\(\s*["']?([^"'\s)]+)["']?\s*\)/g)) {
      links.push({ url, asset: true });
    }
    return { anchors, links };
  }
  walk(parse(isMarkdown ? markdown.render(source) : source), (node) => {
    if (!defaultTreeAdapter.isElementNode(node)) return;
    const attrs = Object.fromEntries(node.attrs.map(({ name, value }) => [name, value]));
    if (attrs.id) anchors.add(attrs.id);
    if (node.tagName === "a" && attrs.name) anchors.add(attrs.name);
    if (isMarkdown && /^h[1-6]$/.test(node.tagName ?? "")) {
      const base = textOf(node)
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}_ -]/gu, "")
        .replaceAll(" ", "-");
      let slug = base;
      for (let n = 1; anchors.has(slug); n++) slug = `${base}-${n}`;
      anchors.add(slug);
    }
    for (const attr of ["href", "src", "poster"]) {
      if (attrs[attr] === undefined) continue;
      links.push({ url: attrs[attr], asset: attr !== "href" || node.tagName === "link" });
    }
  });
  return { anchors, links };
}

/** @param {string} root @param {string} target */
function outside(root, target) {
  const part = relative(root, target);
  return part === ".." || part.startsWith(".." + sep) || isAbsolute(part);
}

/** @param {string} root @param {string[]} files @param {boolean} built */
function verify(root, files, built) {
  /** @type {string[]} */
  const problems = [];
  /** @type {Set<string>} */
  const external = new Set();
  /** @type {Map<string, ReturnType<typeof scan>>} */
  const parsed = new Map();
  /** @param {string} file */
  const document = (file) => {
    const result = parsed.get(file);
    if (result) return result;
    const scanned = scan(file);
    parsed.set(file, scanned);
    return scanned;
  };
  for (const file of files) {
    for (const { url, asset } of document(file).links) {
      /** @param {string} message */
      const fail = (message) => problems.push(`${relative(root, file)} → ${url}: ${message}`);
      try {
        const target = new URL(
          url,
          `${origin}/${relative(root, file).split(sep).map(encodeURIComponent).join("/")}`,
        );
        if (target.origin !== origin) {
          if (built && asset && /^https?:$/.test(target.protocol)) fail("bundle the asset with the game");
          if (!built && /^https?:$/.test(target.protocol)) external.add(target.href.split("#")[0]);
          continue;
        }
        const path = join(root, decodeURIComponent(target.pathname));
        // URL normalizes parent segments within its virtual root. Check raw relative paths as well.
        const rawPath = decodeURIComponent(url.split(/[?#]/)[0]);
        if (built && rawPath.startsWith("/")) {
          fail("use a relative link so it works when the game is hosted in a subfolder");
          continue;
        }
        const diskPath = rawPath.startsWith("/") ? path : resolve(dirname(file), rawPath || file);
        if (outside(root, diskPath) || outside(root, path)) {
          fail("link leaves this checkout");
          continue;
        }
        if (!existsSync(path)) {
          fail("target is missing");
          continue;
        }
        const destination = statSync(path).isDirectory() ? join(path, "index.html") : path;
        if (built && !existsSync(destination)) fail("route has no index.html");
        if (
          target.hash &&
          /\.(md|html)$/.test(destination) &&
          !document(destination).anchors.has(decodeURIComponent(target.hash.slice(1)))
        ) {
          fail("anchor is missing");
        }
      } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
      }
    }
  }
  if (problems.length) throw new Error(problems.join("\n"));
  return [...external].sort((a, b) => a.localeCompare(b));
}

/** @param {string[]} urls */
async function externalLinks(urls) {
  /** @type {string[]} */
  const failures = [];
  for (let i = 0; i < urls.length; i += 6) {
    await Promise.all(
      urls.slice(i, i + 6).map(async (url) => {
        try {
          /** @param {string} method */
          const get = (method) => fetch(url, { method, signal: AbortSignal.timeout(10_000) });
          let response = await get("HEAD");
          if (!response.ok) {
            await response.body?.cancel();
            response = await get("GET");
          }
          await response.body?.cancel();
          if (!response.ok) failures.push(`${url}: HTTP ${response.status}`);
        } catch (error) {
          failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }),
    );
  }
  if (failures.length) throw new Error(failures.sort((a, b) => a.localeCompare(b)).join("\n"));
}

const [mode, ...selected] = process.argv.slice(2);
const built = mode === "--build";
const root = resolve(built ? "dist" : ".");
const entries = built
  ? [...new Bun.Glob("**/*.{html,css}").scanSync(root)]
  : (mode === "--files" ? selected : checkoutFiles()).filter(
      (file) => file.endsWith(".md") && existsSync(file),
    );
if (built && !entries.includes("index.html"))
  throw new Error("Run bun run build before checking the built links.");
const urls = verify(
  root,
  entries.map((file) => resolve(root, file)),
  built,
);
if (mode === "--external") await externalLinks(urls);
console.log(`Checked ${entries.length} ${built ? "built HTML/CSS" : "Markdown"} files.`);
