import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

/** @param {number} pid */
function isDead(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return /** @type {NodeJS.ErrnoException} */ (error).code !== "EPERM";
  }
}

/** @param {string} lock @param {boolean} retry @returns {number} */
function openLock(lock, retry) {
  try {
    return openSync(lock, "wx");
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "EEXIST") throw error;
    const pid = readFileSync(lock, "utf8").trim();
    if (retry && isDead(Number(pid))) {
      unlinkSync(lock);
      return openLock(lock, false);
    }
    throw new Error(
      `Another install, build or check (process ${pid}) holds ${lock}. Wait for it to finish.`,
      { cause: error },
    );
  }
}

/** @param {() => void | Promise<void>} action */
export function withCheckLock(action, dir = "node_modules/.cache") {
  mkdirSync(dir, { recursive: true });
  const lock = dir + "/game-factory.lock";
  const handle = openLock(lock, true);
  const release = () => {
    closeSync(handle);
    unlinkSync(lock);
  };
  try {
    writeFileSync(handle, String(process.pid) + "\n");
    const pending = action();
    if (pending) return pending.finally(release);
  } catch (error) {
    release();
    throw error;
  }
  release();
}
