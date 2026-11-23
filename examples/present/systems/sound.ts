// Sound as code: short chiptune blips scheduled on one AudioContext, no audio files.
let audio: AudioContext | undefined;
let master: GainNode | undefined;
// Mute survives a reload. Storage can be blocked (private mode, sandboxed iframe), so it starts unmuted then.
// The key is the game's own, as the site's origin is shared; a value under the old shared key "muted" carries over.
const MUTE_KEY = "present-muted";
export let muted = (() => {
  try {
    if (localStorage.getItem(MUTE_KEY) === null && localStorage.getItem("muted") !== null)
      localStorage.setItem(MUTE_KEY, localStorage.getItem("muted")!);
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();

function context() {
  if (!audio) {
    audio = new AudioContext();
    master = audio.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(audio.destination);
  }
  return audio;
}
// Phaser handles keys inside its game loop, outside the browser's input event, which autoplay rules
// may not count as a gesture. So the context is resumed in real input events. It is made at load, before
// the first frame, suspended: made in that event, on the title's Enter, it held that frame 140 ms.
// WebKit counts only some events as a gesture (touchend and click, not a touch's pointerdown), so every kind
// resumes, until the context runs; iOS suspends or interrupts it again (a call, the lock screen), and the
// listeners come back then.
const GESTURES = ["pointerdown", "pointerup", "touchend", "click", "keydown"];
const unlock = () => void context().resume();
const listen = () => {
  for (const gesture of GESTURES)
    if (audio!.state === "running") removeEventListener(gesture, unlock);
    else addEventListener(gesture, unlock);
};
context().onstatechange = listen;
listen();

type Voice = { type: OscillatorType; volume?: number; out?: AudioNode };

function tone(frequency: number, start = 0, seconds = 0.1, slide = 1, voice?: Voice) {
  const at = context().currentTime + start;
  const osc = audio!.createOscillator();
  const gain = audio!.createGain();
  osc.type = voice?.type ?? "square";
  osc.frequency.setValueAtTime(frequency, at);
  osc.frequency.exponentialRampToValueAtTime(frequency * slide, at + seconds);
  gain.gain.setValueAtTime(voice?.volume ?? 0.04, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  osc.connect(gain).connect(voice?.out ?? master!);
  osc.start(at);
  osc.stop(at + seconds);
}

// A burst of filtered noise, falling from cutoff to a low thud: 18+ mode's squish. The noise is made once.
let noise: AudioBuffer | undefined;
function burst(seconds: number, volume: number, cutoff: number) {
  const at = context().currentTime;
  if (!noise) {
    noise = audio!.createBuffer(1, audio!.sampleRate * 0.4, audio!.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = audio!.createBufferSource();
  const filter = audio!.createBiquadFilter();
  const gain = audio!.createGain();
  source.buffer = noise;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(cutoff, at);
  filter.frequency.exponentialRampToValueAtTime(cutoff / 8, at + seconds);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  source.connect(filter).connect(gain).connect(master!);
  source.start(at);
  source.stop(at + seconds);
}

const NOTE = {
  B4: 494,
  C5: 523,
  D5: 587,
  E5: 659,
  F5: 698,
  G5: 784,
  C6: 1047,
  E6: 1319,
  G6: 1568,
};
const melody = (notes: number[], step: number, voice?: Voice) =>
  notes.forEach((f, i) => f && tone(f, i * step, step * 0.9, 1, voice));

const TRIANGLE: Voice = { type: "triangle" };
const LAND: Voice = { type: "triangle", volume: 0.05 };
const DASH: Voice = { type: "sawtooth", volume: 0.025 };
const HURT: Voice = { type: "sawtooth", volume: 0.03 };

export const sfx = {
  jump: () => tone(260, 0, 0.12, 1.8),
  land: () => tone(120, 0, 0.06, 0.6, LAND),
  crystal: () => melody([NOTE.E6, NOTE.G6], 0.06),
  secret: () => melody([NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C6 * 2], 0.07),
  stomp: () => tone(180, 0, 0.12, 0.4),
  dash: () => tone(520, 0, 0.12, 2.2, DASH),
  splat: () => {
    burst(0.28, 0.35, 2400);
    tone(150, 0, 0.2, 0.3, { type: "sawtooth", volume: 0.05 });
    tone(70, 0.03, 0.3, 0.5, { type: "square", volume: 0.05 });
  },
  hurt: () => tone(300, 0, 0.35, 0.3, HURT),
  door: () => tone(90, 0, 0.4, 1.6, { type: "triangle", volume: 0.06 }),
  lights: () => melody([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.08, TRIANGLE),
  flourish: () => melody([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.G6, NOTE.C6 * 2], 0.05),
  // The first bar of Jingle Bells (public domain).
  win: () => {
    const { E5, G5, C5, D5 } = NOTE;
    melody([E5, E5, E5, 0, E5, E5, E5, 0, E5, G5, C5, D5, E5], 0.14, TRIANGLE);
  },
};

// Background music: the first line of Deck the Halls (traditional, public domain), quiet, on loop.
// Each pair is a note and its length in eighths; the bass plays one note per quarter.
const EIGHTH = 0.2;
const { G5, F5, E5, D5, C5, B4 } = NOTE;
// prettier-ignore
const LEAD = [G5, 3, F5, 1, E5, 2, D5, 2, C5, 2, D5, 2, E5, 2, C5, 2, D5, 1, E5, 1, F5, 1, D5, 1, E5, 3, D5, 1, C5, 2, B4, 2, C5, 4];
const BASS = [131, 196, 131, 196, 131, 196, 131, 196, 98, 147, 98, 147, 131, 196, 131, 131];
const PHRASE = 32 * EIGHTH;
let loop: ReturnType<typeof setInterval> | undefined;
let bus: GainNode | undefined; // a phrase is scheduled whole, so stop() cuts this bus off
let next = 0;

function phrase(at: number) {
  const lead: Voice = { type: "square", volume: 0.012, out: bus };
  const bass: Voice = { type: "triangle", volume: 0.03, out: bus };
  let t = at;
  for (let i = 0; i < LEAD.length; i += 2) {
    tone(LEAD[i], t - audio!.currentTime, LEAD[i + 1] * EIGHTH * 0.9, 1, lead);
    t += LEAD[i + 1] * EIGHTH;
  }
  BASS.forEach((f, i) => tone(f, at - audio!.currentTime + i * 2 * EIGHTH, 2 * EIGHTH * 0.8, 1, bass));
}

export const music = {
  /** Starts the loop, once; the context only sounds after the first input (see unlock above). */
  start() {
    if (loop) return;
    next = context().currentTime + 0.1;
    bus = audio!.createGain();
    bus.connect(master!);
    const queue = () => {
      next = Math.max(next, audio!.currentTime + 0.05); // a throttled background tab skips, never piles up
      while (next < audio!.currentTime + 1) {
        phrase(next);
        next += PHRASE;
      }
    };
    queue();
    loop = setInterval(queue, 500);
  },
  stop() {
    clearInterval(loop);
    bus?.disconnect();
    loop = bus = undefined;
  },
};

/** M or the HUD speaker mutes and unmutes everything, music and effects. */
export function toggleMute() {
  muted = !muted;
  context();
  master!.gain.value = muted ? 0 : 1;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // storage blocked: the mute lasts until the page reloads
  }
  return muted;
}
