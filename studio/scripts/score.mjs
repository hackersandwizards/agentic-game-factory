// The film's sound, written as code: a chiptune arrangement of Deck the Halls (traditional Welsh
// melody, public domain), the same tune and voices as the game's music loop
// (examples/present/systems/sound.ts), plus effects on visible actions. Writes
// greeting/assets/audio/score.wav for one customer, since the quest ticks follow its quest log.
// The cue times mirror greeting/index.html (DUR, CUTS, the map walk, the callout, BOSS,
// PRESS_AT, DISSOLVE): change both together. Written at its mix levels, unnormalised:
// scripts/master.mjs sets the finished film's loudness without touching its dynamics.
//   bun scripts/score.mjs <customer>   (reads <customer>.json from $GREETING_CUSTOMERS, else
//   greeting/customers)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
// the rooms' timing, shared with greeting/index.html: it sets globalThis.ROOMS
import "../greeting/rooms.js";

// a customer is a file slug
const NAME = process.argv[2];
if (!/^[a-z0-9-]+$/.test(NAME ?? "")) throw new Error(`customer slug expected, got ${NAME}`);
const ROOT = fileURLToPath(new URL("../greeting/", import.meta.url));
const CUSTOMERS = resolve(process.env.GREETING_CUSTOMERS || `${ROOT}customers`);
// the composition's defaults, then the customer's values, as the render resolves them
const vars = readFileSync(`${ROOT}index.html`, "utf8").match(/data-composition-variables='(.*?)'\n/s)[1];
const META = JSON.parse(vars.replaceAll("&#39;", "'"));
const OWN = JSON.parse(readFileSync(`${CUSTOMERS}/${NAME}.json`, "utf8"));
// with language en, a value equal to its German default takes its English one, as in the render
const C = { ...Object.fromEntries(META.map((v) => [v.id, v.default])), ...OWN };
if (C.language === "en")
  for (const v of META) if (v.defaultEn !== undefined && C[v.id] === v.default) C[v.id] = v.defaultEn;
const RATE = 44100;
// cue times are story time, as in greeting/index.html; the film runs PACE times slower, so every
// note and effect lands PACE times later. Notes last PACE times longer (a slower tempo, same
// pitch); an effect keeps its own duration and rhythm, as the picture's animations do (fx).
const DUR = 52.1;
const PACE = 1.5;
const out = new Float32Array(Math.ceil(DUR * PACE * RATE));

// one voice: square, triangle or noise, with a linear attack and an exponential decay
let seed = 7;
const noise = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff - 1;
function tone(f, at, len, { type = "square", vol = 0.1, slide = 1, vib = 0, duty = 0.5 } = {}) {
  const n = Math.floor(len * PACE * RATE);
  const s0 = Math.floor(at * PACE * RATE);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n && s0 + i < out.length; i++) {
    const p = i / n;
    const fr = f * slide ** p * (1 + vib * Math.sin((i / RATE) * 2 * Math.PI * 7));
    phase = (phase + fr / RATE) % 1;
    let v;
    if (type === "square") v = phase < duty ? 1 : -1;
    else if (type === "triangle") v = 4 * Math.abs(phase - 0.5) - 1;
    else {
      // noise through a one-pole low-pass whose cut-off is f (Hz), sliding like a tone
      const a = Math.min(1, (2 * Math.PI * fr) / RATE);
      lp += a * (noise() - lp);
      v = lp * 2;
    }
    const env = Math.min(1, i / (0.004 * RATE)) * Math.exp(-3 * p);
    out[s0 + i] += v * vol * env;
  }
}

// an effect or a drum: at a story time, lasting real seconds
const fx = (f, at, len, o) => tone(f, at, len / PACE, o);

// ---- music: four lines in eighths of 0.2 s, as the game's loop
const N = {
  B3: 247,
  C4: 262,
  D4: 294,
  E4: 330,
  F4: 349,
  Fs4: 370,
  G4: 392,
  A4: 440,
  B4: 494,
  C5: 523,
  D5: 587,
  E5: 659,
  F5: 698,
  Fs5: 740,
  G5: 784,
  A5: 880,
  B5: 988,
  C6: 1047,
};
const E8 = 0.2;
// prettier-ignore
const LINE1 = ["G5",3,"F5",1,"E5",2,"D5",2,"C5",2,"D5",2,"E5",2,"C5",2,"D5",1,"E5",1,"F5",1,"D5",1,"E5",3,"D5",1,"C5",2,"B4",2,"C5",4];
// prettier-ignore
const LINE3 = ["D5",3,"E5",1,"F5",2,"D5",2,"E5",3,"F5",1,"G5",2,"D5",2,"E5",1,"Fs5",1,"G5",2,"A5",1,"B5",1,"C6",2,"B5",2,"A5",2,"G5",4];
const BASS1 = [131, 196, 131, 196, 131, 196, 131, 196, 98, 147, 98, 147, 131, 196, 131, 131];
const BASS3 = [147, 220, 147, 220, 131, 196, 131, 196, 165, 247, 220, 147, 196, 147, 196, 98];
// the counter-line of every second verse: long notes on a thinner pulse, moving against the
// tune, a bar of eighths per four entries
// prettier-ignore
const COUNTER1 = ["E4",4,"F4",2,"G4",2,"G4",4,"E4",4,"B3",4,"D4",4,"E4",2,"D4",2,"C4",4];
// prettier-ignore
const COUNTER3 = ["F4",4,"A4",4,"G4",4,"E4",4,"B3",4,"D4",4,"D4",2,"E4",2,"Fs4",2,"G4",2];
const PHRASE = 32 * E8;
const BOSS_END = 37.8;
const { START: ROOMS_START, END: ROOMS_END } = globalThis.ROOMS;
const INTRO_END = 8.6;
// per stop, whether it is a room in two places with two trainers
const STOPS = [1, 2, 3, 4]
  .filter((i) => C[`stop${i}Place`])
  .map((i) => C[`stop${i}Landmark`].includes("+") && [C[`stop${i}Npc1`], C[`stop${i}Npc2`]].every(Boolean));
const ROOM_T0 = globalThis.ROOMS.t0(STOPS);
// the music's level over the film: down under the map and the speech bubbles, up for the boss
// and the title screen, eased over half a second at each change
// (about 6 dB under the intro and the title screen once mastered, whose limiter narrows them)
const LEVELS = [
  [0, 0.9],
  [INTRO_END, 0.3],
  [ROOMS_END - 0.6, 1.15],
  [BOSS_END, 0.9],
];
const level = (t) => {
  let v = LEVELS[0][1];
  for (const [at, l] of LEVELS) v += (l - v) * Math.min(1, Math.max(0, (t - at) / 0.5));
  return v;
};
// notes starting at or after `until` are left out, so a line can stop where the next begins
function line(at, lead, bass, vol, until = DUR, counter = null) {
  let t = at;
  if (counter)
    for (let i = 0, c = at; i < counter.length; i += 2) {
      const len = Math.min(counter[i + 1] * E8 * 0.95, until - c);
      if (len > 0)
        tone(N[counter[i]], c, len, {
          vol: 0.022 * vol * level(c),
          duty: 0.25,
        });
      c += counter[i + 1] * E8;
    }
  for (let i = 0; i < lead.length; i += 2) {
    const len = Math.min(lead[i + 1] * E8 * 0.9, until - t);
    if (len > 0) tone(N[lead[i]], t, len, { vol: 0.05 * vol * level(t) });
    t += lead[i + 1] * E8;
  }
  bass.forEach((f, i) => {
    const b = at + i * 2 * E8;
    if (b < until)
      tone(f, b, Math.min(2 * E8 * 0.8, until - b), {
        type: "triangle",
        vol: 0.12 * vol * level(b),
      });
  });
}
const verse = [
  [LINE1, BASS1, COUNTER1],
  [LINE1, BASS1, COUNTER1],
  [LINE3, BASS3, COUNTER3],
  [LINE1, BASS1, COUNTER1],
];
// the noise channel: a closed hi-hat on every eighth, a snare on beats two and four, from the
// second phrase on, riding the music's level
const drums = (from, until) => {
  for (let k = 0, t = from; t < until - 1e-9; k++, t = from + k * E8) {
    const v = level(t);
    fx(9000, t, 0.03, { type: "noise", vol: 0.05 * v });
    if (k % 4 === 2) fx(2600, t, 0.12, { type: "noise", vol: 0.16 * v });
  }
};
// from the first frame to the title screen, then the tune starts over from its top with the game:
// one phrase, ending on its tonic, and a held C major chord that rings out by the last frame
const PRESS = BOSS_END + 4.0;
for (let k = 0, t = 0; t < PRESS; k++, t += PHRASE) {
  const [lead, bass, counter] = verse[k % 4];
  line(t, lead, bass, k === 0 ? 0.7 : 1, PRESS, k % 2 ? counter : null);
}
line(PRESS, LINE1, BASS1, 1);
const END = PRESS + PHRASE;
drums(PHRASE, PRESS);
drums(PRESS + 4 * E8, END);
[N.C5, N.E5, N.G5, N.C6].forEach((f) =>
  tone(f, END, DUR - END - 0.05, { vol: 0.035 * level(END), vib: 0.01 }),
);
[65, 131].forEach((f) => tone(f, END, DUR - END - 0.05, { type: "triangle", vol: 0.12 * level(END) }));

// ---- effects, each on its cause on screen
const typing = (t0, chars, cps) => {
  for (let i = 0; i < chars; i += 2)
    fx(3200 + (i % 3) * 600, t0 + i / cps / PACE, 0.018, {
      type: "noise",
      vol: 0.12,
    });
};
// frame 0: the staff flares, a sparkle that opens the film
[N.G5, N.C6, N.E5 * 2, N.G5 * 2].forEach((f, i) =>
  fx(f, 0.02 + (i * 0.05) / PACE, 0.25, { vol: 0.03, vib: 0.02 }),
);
// only while the set is fully open (index.html: the callout from 2.9 s, closing at 5.85 s,
// story time); up to four lines, typed at 22 characters a second or faster so the last holds
// 0.6 s, each holding 0.55 s on the frame clock
const CLOSE = 5.85;
const SET = C.screenScript.split("|").filter(Boolean).slice(0, 4);
const typedChars = SET.filter((l) => !l.startsWith("✓")).reduce((n, l) => n + l.length, 0);
const CPS = Math.max(22, typedChars / Math.max(0.5, 4.4 - 0.6 - 0.55 * (SET.length - 1)));
let t = 2.9;
for (const l of SET) {
  if (l.startsWith("✓")) {
    if (t < CLOSE) fx(N.C6, t, 0.05, { vol: 0.035 });
    t += 0.55 / PACE;
    continue;
  }
  typing(t, Math.min(l.length, Math.max(0, Math.floor((CLOSE - t) * PACE * CPS))), CPS);
  t += (l.length / CPS + 0.55) / PACE;
}
// portal whooshes, in and out, and the two scene cuts: two takes, rotated
[7.4, ROOMS_START, ROOMS_END, BOSS_END].forEach((w, i) =>
  fx(i % 2 ? 300 : 500, w - 0.1, 0.6, {
    type: "noise",
    vol: 0.5,
    slide: i % 2 ? 8 : 5,
  }),
);
// a hit on every scene cut: map, rooms, each room change, boss, workshop, title screen
const cuts = [INTRO_END, ROOMS_START, ROOMS_END, BOSS_END, PRESS];
for (let i = 1; i < STOPS.length; i++) cuts.push(ROOMS_START + ROOM_T0[i]);
cuts.forEach((c) => {
  fx(90, c, 0.28, { type: "triangle", vol: 0.5, slide: 0.5 });
  fx(1800, c, 0.12, { type: "noise", vol: 0.35, slide: 0.3 });
});
// quest ticks on the map: the hero reaches quest k at WALK0 + k * SLICE + WALK_D, walking at
// its own pace (index.html: WALK_D = 0.8 * SLICE / PACE)
const quests = C.questLog.split("|").filter(Boolean).length;
const SLICE = 3.0 / Math.max(1, quests);
for (let k = 0; k < quests; k++) {
  const at = INTRO_END + 0.5 + k * SLICE + (0.8 * SLICE) / PACE;
  fx(N.C6, at, 0.05, { vol: 0.04 });
  fx(N.C6 * 1.5, at + 0.05 / PACE, 0.07, { vol: 0.04 });
}
// boss: a swell into the arena, a sting as the machine drops in
tone(120, ROOMS_END - 0.8, 0.8, { type: "noise", vol: 0.25, slide: 20 });
[110, 131, 156].forEach((f) => fx(f, ROOMS_END, 0.9, { type: "triangle", vol: 0.22, slide: 0.94 }));
[N.E5, N.D5, N.B4].forEach((f, i) => fx(f / 2, ROOMS_END + (0.05 + i * 0.12) / PACE, 0.3, { vol: 0.05 }));
// boss: a rising beam per spell (or scan), the last one longer; its throw a low hop, unless the
// boss is friendly (never fought) and throws nothing
[1.0, 2.4, 3.1].forEach((s, i) =>
  fx(400, ROOMS_END + s, i === 2 ? 0.7 : 0.45, {
    vol: 0.045,
    slide: 3,
    vib: 0.03,
  }),
);
if (!(C.bossArt.startsWith("{") && JSON.parse(C.bossArt).friendly))
  fx(200, ROOMS_END + 1.7, 0.3, { type: "triangle", vol: 0.15, slide: 0.5 });
// "Neuer Freund": a short victory jingle as the bar names the boss a friend, once its line is
// typed (index.html: REVEAL)
const REVEAL = 3.8 + 0.3 + [...C.bossLine].length / 60 / PACE + 0.15;
[
  [N.C5, 0, 0.1],
  [N.E5, 0.1, 0.1],
  [N.G5, 0.2, 0.1],
  [N.C6, 0.3, 0.2],
  [N.G5, 0.5, 0.1],
  [N.C6, 0.6, 0.5],
].forEach(([f, d, len]) => {
  fx(f, ROOMS_END + REVEAL + d / PACE, len, { vol: 0.06 });
  fx(f / 2, ROOMS_END + REVEAL + d / PACE, len, { type: "triangle", vol: 0.12 });
});
// the dissolve into the title screen sparkles; PRESS START blips as the board lights
for (let i = 0; i < 12; i++) fx(2000 + ((i * 370) % 1500), PRESS + (i * 0.1) / PACE, 0.06, { vol: 0.02 });
[N.E5 * 2, N.G5 * 2].forEach((f, i) => fx(f, PRESS + 1.2 + (i * 0.06) / PACE, 0.07, { vol: 0.04 }));

// the closing chord fades to silence over the last half second; scale the peak to -1 dBFS
const FADE = Math.floor(0.5 * RATE);
for (let i = 0; i < FADE; i++) out[out.length - 1 - i] *= i / FADE;
const peak = out.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
const g = Math.min(1, 0.89 / peak);
const pcm = Buffer.alloc(44 + out.length * 2);
pcm.write("RIFF", 0);
pcm.writeUInt32LE(36 + out.length * 2, 4);
pcm.write("WAVEfmt ", 8);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(RATE, 24);
pcm.writeUInt32LE(RATE * 2, 28);
pcm.writeUInt16LE(2, 32);
pcm.writeUInt16LE(16, 34);
pcm.write("data", 36);
pcm.writeUInt32LE(out.length * 2, 40);
out.forEach((v, i) => pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * g)) * 32767), 44 + i * 2));
mkdirSync(`${ROOT}assets/audio`, { recursive: true });
writeFileSync(`${ROOT}assets/audio/score.wav`, pcm);
