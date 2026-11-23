export const POINTS = { kill: 100, crystal: 100, secret: 1000, unhurt: 500, gold: 500 };
export const GOLD_TIME = 30;

// Gold and unhurt with the secret usually earns A. S also asks for more of the level.
export const RANKS = [
  ["S", 4600],
  ["A", 3500],
  ["B", 2500],
  ["C", 0],
] as const;

export function rank(score: number) {
  return RANKS.find(([, minimum]) => score >= minimum)?.[0] ?? "C";
}

/** The rank above the one a score earns, with its minimum; none above S. */
export function rankAbove(score: number) {
  const at = RANKS.findIndex(([name]) => name === rank(score));
  return at > 0 ? RANKS[at - 1] : undefined;
}

export function earnsGold(seconds: number) {
  return seconds < GOLD_TIME;
}

export function formatClock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function readRecord(value: string | null) {
  const record = Number(value);
  return Number.isSafeInteger(record) && record >= 0 ? record : 0;
}

type ScoredRun = {
  crystals: number;
  totalCrystals: number;
  secret: boolean;
  longestChain: number;
  score: number;
  hits: number;
};

type Award = [key: "crystals" | "secret" | "bugs" | "unhurt" | "time", points: number];

export function winAwards(
  run: Pick<ScoredRun, "crystals" | "secret" | "score" | "hits">,
  gold: boolean,
): Award[] {
  return [
    ["crystals", run.crystals * POINTS.crystal],
    ["secret", run.secret ? POINTS.secret : 0],
    ["bugs", run.score],
    ["unhurt", run.hits ? 0 : POINTS.unhurt],
    ["time", gold ? POINTS.gold : 0],
  ];
}

export function awardTotal(awards: readonly Award[]) {
  return awards.reduce((sum, [, points]) => sum + points, 0);
}

export function recordImprovements(time: number, score: number, best: number, bestScore: number) {
  const improved: ("score" | "time")[] = [];
  if (score > bestScore) improved.push("score");
  if (!best || time < best) improved.push("time");
  return improved;
}

/** The next rank and the two remaining awards with the highest point values. */
export function rankTips(run: ScoredRun, gold: boolean) {
  const above = rankAbove(run.score);
  if (!above) return;
  const [rank, minimum] = above;
  const tips: ["crystals" | "secret" | "chains" | "unhurt" | "speed", number][] = [
    ["crystals", (run.totalCrystals - run.crystals) * POINTS.crystal],
    ["secret", run.secret ? 0 : POINTS.secret],
    ["chains", POINTS.kill * (run.longestChain + 1)],
    ["unhurt", run.hits ? POINTS.unhurt : 0],
    ["speed", gold ? 0 : POINTS.gold],
  ];
  const best = tips
    .filter(([, points]) => points)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);
  return { rank, minimum, tips: best };
}
