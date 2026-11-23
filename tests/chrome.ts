// The browser for the tests and the playtest: Chrome for Testing from the Puppeteer cache, the same one the
// chrome-devtools MCP server uses, so every tool shares one download. Downloaded there on first use; the installed
// Google Chrome is never started. The full browser, not Playwright's headless shell: the shell fails the title's fades,
// the dash line and the terminal greeting.
import {
  Browser,
  detectBrowserPlatform,
  getInstalledBrowsers,
  install,
  resolveBuildId,
} from "@puppeteer/browsers";

const cacheDir =
  process.env.PUPPETEER_CACHE_DIR ?? `${process.env.USERPROFILE ?? process.env.HOME}/.cache/puppeteer`;
const platform = detectBrowserPlatform();
if (!platform) throw new Error("Chrome for Testing is unavailable on this platform.");
const chrome =
  (await getInstalledBrowsers({ cacheDir }))
    .filter((b) => b.browser === Browser.CHROME && b.platform === platform)
    .sort((a, b) => a.buildId.localeCompare(b.buildId, "en", { numeric: true }))
    .at(-1) ??
  (await install({
    browser: Browser.CHROME,
    buildId: await resolveBuildId(Browser.CHROME, platform, "stable"),
    cacheDir,
  }));

export const launchOptions = {
  executablePath: chrome.executablePath,
  args: ["--use-mock-keychain", "--password-store=basic"],
};
