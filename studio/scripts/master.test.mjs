// bun test scripts: master.mjs on clips made here with ffmpeg, which the studio needs anyway.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MASTER = fileURLToPath(new URL("master.mjs", import.meta.url));
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")}\n${r.stderr}`);
  return r.stdout;
};
// the mastered clip's streams as "codec_type duration" lines, durations to 0.1 s
const mastered = (...sound) => {
  const dir = mkdtempSync(join(tmpdir(), "master-"));
  try {
    const picture = ["-f", "lavfi", "-i", "testsrc=size=160x90:rate=30:duration=1"];
    run("ffmpeg", ["-v", "error", ...picture, ...sound, "-shortest", join(dir, "in.mp4")]);
    run("bun", [MASTER, join(dir, "in.mp4"), join(dir, "out.mp4")]);
    const streams = ["-show_entries", "stream=codec_type,duration", "-of", "csv=p=0"];
    return run("ffprobe", ["-v", "error", ...streams, join(dir, "out.mp4")])
      .trim()
      .split("\n")
      .map((line) => line.replace(/,(.*)/, (_, s) => ` ${Number(s).toFixed(1)}`));
  } finally {
    rmSync(dir, { recursive: true });
  }
};
const lavfi = (source) => ["-f", "lavfi", "-i", `${source}:sample_rate=48000:duration=1`];

test("a clip without an audio stream gets the hold and stays without sound", () => {
  expect(mastered()).toEqual(["video 3.0"]);
}, 60_000);

test("a clip with a silent audio track keeps the track", () => {
  expect(mastered(...lavfi("anullsrc=channel_layout=stereo"))).toEqual(["video 3.0", "audio 3.0"]);
}, 60_000);

test("a clip with sound is mastered", () => {
  expect(mastered(...lavfi("sine=frequency=440"))).toEqual(["video 3.0", "audio 3.0"]);
}, 60_000);
