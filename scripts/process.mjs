import { execFileSync, spawn, spawnSync } from "node:child_process";

/** @param {string} command @param {string[]} args @param {import("node:child_process").SpawnSyncOptions} options */
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.signal ?? result.status}).`);
}

/** @param {string} command @param {string[]} args @param {Omit<import("node:child_process").ExecFileSyncOptionsWithStringEncoding, "encoding">} options */
export function output(command, args, options = {}) {
  return execFileSync(command, args, { ...options, encoding: "utf8" });
}

/** @param {string[]} args */
export function git(args) {
  return output("git", args);
}

/** @param {string} list */
export function paths(list) {
  return list.split("\0").filter(Boolean);
}

export function checkoutFiles() {
  return [...new Set(paths(git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])))];
}

/** @param {string} label @param {() => void} action */
export function task(label, action) {
  console.log(`\n[check] ${label}`);
  const start = performance.now();
  action();
  console.log(`[check] ${label} passed in ${elapsed(start)}`);
}

/** @param {number} start */
function elapsed(start) {
  return `${((performance.now() - start) / 1000).toFixed(2)}s`;
}

/** @param {string} command @param {[label: string, args: string[]][]} steps */
export async function parallelTasks(command, steps) {
  const results = await Promise.all(
    steps.map(([label, args]) => {
      const start = performance.now();
      return new Promise((resolve) => {
        const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
        /** @type {Buffer[]} */
        const chunks = [];
        child.stdout.on("data", (chunk) => chunks.push(chunk));
        child.stderr.on("data", (chunk) => chunks.push(chunk));
        child.on("error", (error) => chunks.push(Buffer.from(`${error.message}\n`)));
        child.on("close", (status, signal) => {
          const outcome = status === 0 ? "passed" : `failed (${signal ?? status})`;
          const output = Buffer.concat(chunks).toString();
          console.log(
            `\n[check] ${label}\n${output}${output && !output.endsWith("\n") ? "\n" : ""}[check] ${label} ${outcome} in ${elapsed(start)}`,
          );
          resolve(status === 0 ? undefined : label);
        });
      });
    }),
  );
  const failures = results.filter(Boolean);
  if (failures.length) {
    console.error(`[check] Failed steps: ${failures.join(", ")}`);
    return false;
  }
  return true;
}
