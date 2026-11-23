// The rooms' timing in story time, read by index.html (a script tag) and scripts/score.mjs (an
// import), so the picture and the score land on the same beats. BEAT is the score's quarter note
// (eighths of 0.2 s; 0.6 s on the frame clock): the rooms and what happens in them land on it.
// ROOMS.t0(two) gives each room's start after START, two[r] true for a room in two places with
// two trainers ("A+B" landmark), which plays two beats and gets EXTRA on top of the others' whole
// beats; the last room holds to END.
{
  const BEAT = 0.4;
  const START = 12.8;
  const END = 32.0;
  const EXTRA = 3 * BEAT;
  const t0 = (two) => {
    const d =
      Math.floor((END - START - EXTRA * two.filter(Boolean).length) / Math.max(1, two.length) / BEAT + 1e-9) *
      BEAT;
    return two.map((_, r) => two.slice(0, r).reduce((a, q) => a + d + (q ? EXTRA : 0), 0));
  };
  globalThis.ROOMS = { BEAT, START, END, EXTRA, t0 };
}
