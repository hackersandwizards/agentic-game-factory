// Masters a rendered film's sound: one fixed gain to -14 LUFS integrated and a peak limiter,
// so the score's level changes (the dips under the map and the speech bubbles, the closing fade)
// survive, which loudnorm's dynamic mode flattens. Re-measures the AAC result and corrects until
// it lands within 0.5 LU of -14 with the true peak under -2 dBTP. The picture is encoded once for
// pixel art (CRF 24 kept SSIM 0.990 against the CRF 16 render at half its size), with the index up
// front so a phone starts playing before the download ends. The last frame holds HOLD seconds
// past the end, the score having faded to silence, so a player stopping there shows it finished.
// A film without sound, no audio stream or a silent one, gets the picture and the hold only.
//   bun scripts/master.mjs <in.mp4> <out.mp4>
import { spawnSync } from "node:child_process";
import { renameSync, rmSync } from "node:fs";

const [IN, OUT] = process.argv.slice(2);
const measure = (file) => {
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  if (r.error) throw r.error;
  const sum = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
  // NaN without sound: no audio stream prints no summary, silence a peak of -inf
  return {
    i: Number(sum.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]),
    tp: Number(sum.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]),
  };
};
const HOLD = 2;
const src = measure(IN);
const VIDEO = `${OUT}.video.mp4`;
// each try muxes into TMP, so a failed master leaves an earlier good OUT in place, and neither the
// silent picture nor an output that misses the target
const TMP = `${OUT}.tmp.mp4`;
const silent = Number.isNaN(src.tp);
let gain = silent ? 0 : -14 - src.i;
try {
  const enc = spawnSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    IN,
    "-an",
    "-vf",
    `tpad=stop_mode=clone:stop_duration=${HOLD}`,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-tune",
    "animation",
    "-crf",
    "24",
    "-pix_fmt",
    "yuv420p",
    VIDEO,
  ]);
  if (enc.status !== 0) throw new Error(enc.stderr.toString());
  // the limiter runs 4x oversampled, so it catches the peaks between samples the AAC encode
  // would otherwise reconstruct above the limit
  let limit = -5;
  let k = 0;
  for (; k < 8; k++) {
    const r = spawnSync("ffmpeg", [
      "-v",
      "error",
      "-y",
      "-i",
      VIDEO,
      "-i",
      IN,
      "-map",
      "0:v",
      "-map",
      "1:a?",
      "-c:v",
      "copy",
      "-movflags",
      "+faststart",
      "-af",
      `volume=${gain.toFixed(2)}dB,aresample=192000,alimiter=limit=${10 ** (limit / 20)}:attack=1:release=60:level=false,aresample=48000,apad=pad_dur=${HOLD}`,
      "-ar",
      "48000",
      "-c:a",
      "aac",
      "-b:a",
      "256k",
      TMP,
    ]);
    if (r.status !== 0) throw new Error(r.stderr.toString());
    if (silent) break;
    const m = measure(TMP);
    console.log(`master: ${m.i} LUFS, true peak ${m.tp} dBTP`);
    if (Math.abs(m.i + 14) <= 0.5 && m.tp < -2) break;
    gain += -14 - m.i;
    if (m.tp >= -2) limit -= 0.5;
  }
  if (k === 8) throw new Error("master: no gain meets -14 LUFS under -2 dBTP");
  renameSync(TMP, OUT);
} catch (e) {
  rmSync(TMP, { force: true });
  throw e;
} finally {
  rmSync(VIDEO, { force: true });
}
