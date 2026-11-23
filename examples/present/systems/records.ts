import { readRecord } from "../domain/score";

// The best time and the best score this browser kept, one key each.
const TIME_KEY = "present-best-time";
const SCORE_KEY = "present-best-score";

/** Keeps `value` under `key` where it `beats` the record kept there, and returns that record: 0 where none is kept. */
function keep(key: string, value: number, beats: (record: number) => boolean) {
  let record = 0;
  try {
    record = readRecord(localStorage.getItem(key));
    if (beats(record)) localStorage.setItem(key, String(value));
  } catch {
    // Storage can be missing or blocked (private mode): no record, the run still counts.
  }
  return record;
}

/** Keeps a win's time and score where they beat the browser's records, and returns the records they met. */
export function keepRecords(time: number, score: number) {
  const best = keep(TIME_KEY, time, (record) => !record || time < record);
  const bestScore = keep(SCORE_KEY, score, (record) => score > record);
  return { best, bestScore };
}
