import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { withCheckLock } from "../scripts/locks.mjs";

vi.mock("node:fs", async (importOriginal) => {
  const original = /** @type {typeof fs} */ (await importOriginal());
  return {
    ...original,
    mkdirSync: vi.fn(original.mkdirSync),
    openSync: vi.fn(original.openSync),
  };
});

const cache = resolve("node_modules/.cache");
const { existsSync, readFileSync } = fs;
/** @type {string} */
let dir;
/** @type {string} */
let lock;
const mockMkdir = vi.mocked(fs.mkdirSync);
const mockOpen = vi.mocked(fs.openSync);

beforeEach(() => {
  fs.mkdirSync(cache, { recursive: true });
  dir = fs.mkdtempSync(resolve(cache, "locks-"));
  lock = resolve(dir, "game-factory.lock");
});

afterEach(() => {
  vi.restoreAllMocks();
  mockMkdir.mockReset();
  mockOpen.mockReset();
  fs.rmSync(dir, { recursive: true, force: true });
});

/** @param {number} pid */
function writeLock(pid) {
  fs.writeFileSync(lock, String(pid) + "\n");
}

test("takes over a dead process's lock and removes it when done", () => {
  const child = spawnSync(process.execPath, ["-e", ""]);
  expect(child.status).toBe(0);
  writeLock(child.pid);
  const action = vi.fn(() => {
    expect(readFileSync(lock, "utf8")).toBe(String(process.pid) + "\n");
  });

  expect(withCheckLock(action, dir)).toBeUndefined();

  expect(action).toHaveBeenCalledOnce();
  expect(existsSync(lock)).toBe(false);
});

test("a live process's lock stays in place", () => {
  writeLock(process.pid);
  const action = vi.fn();

  expect(() => withCheckLock(action, dir)).toThrow(`process ${process.pid}`);
  expect(() => withCheckLock(action, dir)).toThrow(
    `Another install, build or check (process ${process.pid}) holds ${lock}. Wait for it to finish.`,
  );

  expect(action).not.toHaveBeenCalled();
  expect(readFileSync(lock, "utf8")).toBe(String(process.pid) + "\n");
});

test("removes the lock when the action throws", () => {
  const error = new Error("action failed");
  expect(() =>
    withCheckLock(() => {
      throw error;
    }, dir),
  ).toThrow(error);
  expect(existsSync(lock)).toBe(false);
  const handle = mockOpen.mock.results[0].value;
  expect(() => fs.fstatSync(handle)).toThrow(expect.objectContaining({ code: "EBADF" }));
});

test.each(["", "not-a-number", "-1"])("keeps a lock with invalid PID content %j", (content) => {
  fs.writeFileSync(lock, content);
  const probe = vi.spyOn(process, "kill").mockReturnValue(true);
  const action = vi.fn();

  expect(() => withCheckLock(action, dir)).toThrow(`process ${content}`);
  expect(probe).not.toHaveBeenCalled();
  expect(action).not.toHaveBeenCalled();
  expect(readFileSync(lock, "utf8")).toBe(content);
});

test("keeps a lock when its holder cannot be probed", () => {
  writeLock(process.pid);
  vi.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error("permission denied"), { code: "EPERM" });
  });
  const action = vi.fn();

  expect(() => withCheckLock(action, dir)).toThrow(`process ${process.pid}`);
  expect(action).not.toHaveBeenCalled();
  expect(readFileSync(lock, "utf8")).toBe(String(process.pid) + "\n");
});

test("rethrows an unexpected open error unchanged", () => {
  const error = Object.assign(new Error("permission denied"), { code: "EACCES" });
  mockOpen.mockImplementationOnce(() => {
    throw error;
  });

  expect(() => withCheckLock(vi.fn(), dir)).toThrow(expect.toSatisfy((thrown) => thrown === error));
});

test("keeps a competing lock encountered during stale-lock takeover", () => {
  const stalePid = 12345;
  writeLock(stalePid);
  vi.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error("no such process"), { code: "ESRCH" });
  });
  const error = Object.assign(new Error("competing lock"), { code: "EEXIST" });
  mockOpen
    .mockImplementationOnce(mockOpen.getMockImplementation() ?? fs.openSync)
    .mockImplementationOnce(() => {
      writeLock(stalePid);
      throw error;
    });
  const action = vi.fn();

  expect(() => withCheckLock(action, dir)).toThrow(
    expect.objectContaining({ cause: expect.toSatisfy((cause) => cause === error) }),
  );
  expect(action).not.toHaveBeenCalled();
  expect(readFileSync(lock, "utf8")).toBe(String(stalePid) + "\n");
});

test("uses the cache directory by default", () => {
  const error = new Error("stop before opening the default lock");
  mockMkdir.mockImplementationOnce(() => {
    throw error;
  });

  expect(() => withCheckLock(vi.fn())).toThrow(error);
  expect(fs.mkdirSync).toHaveBeenCalledWith("node_modules/.cache", { recursive: true });
});

test.each([false, true])(
  "holds the lock until an asynchronous action settles (rejects: %s)",
  async (rejects) => {
    const error = new Error("async action failed");
    const pending = withCheckLock(async () => {
      await Promise.resolve();
      expect(readFileSync(lock, "utf8")).toBe(String(process.pid) + "\n");
      if (rejects) throw error;
    }, dir);
    expect(pending).toBeInstanceOf(Promise);
    expect(existsSync(lock)).toBe(true);
    expect(await pending?.catch((reason) => reason)).toBe(rejects ? error : undefined);
    expect(existsSync(lock)).toBe(false);
  },
);
