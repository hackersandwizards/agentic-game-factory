import { chainEnds, chainPoints, INVULNERABLE_MS, isStomp, killsBug, LIVES, STOMP_GRACE_MS } from "./combat";
import { awardTotal, earnsGold, winAwards } from "./score";

type Moving = Parameters<typeof isStomp>[0] & { center: { x: number } };

// The run is won this many px before the goal. He stops about 80 px short of it (the run brakes in about 15 px, a dash
// overshoots the line by up to 16 px in one step), so he never hides it.
const FINISH = 112;

/** What stands for the level's objects in its run (their sprites, say): the run hands each back in its events and never looks inside. */
type Parts = { pickup: unknown; bug: unknown; checkpoint: unknown };

/** What a run announces, each once, as it happens. */
export type RunEvents<P extends Parts> = {
  collected: { pickup: P["pickup"]; secret: boolean };
  healed: { pickup: P["pickup"] };
  squished: { bug: P["bug"]; stomp: boolean; chain: number; points: number };
  hurt: { fall: boolean; from: number };
  checkpoint: { checkpoint: P["checkpoint"] };
  gameOver: undefined;
  won: { time: number; gold: boolean; awards: ReturnType<typeof winAwards> };
};

type Handlers<Events> = { [Type in keyof Events]?: ((event: Events[Type]) => void)[] };

/** One run of a level: lives, crystals, the kill chain, the checkpoint, the clock, and how it ends. */
export class Run<P extends Parts> {
  lives = LIVES;
  crystals = 0;
  secret = false;
  score = 0;
  chain = 0;
  kills = 0;
  longestChain = 0;
  hits = 0;
  won = false;
  gameOver = false;
  invulnerableUntil = 0;
  startedAt = Infinity; // when he first moves: the clock shows 0:00 until then
  readonly checkpoint: { x: number; y: number };
  readonly totalCrystals: number;
  private readonly checkpoints: number;
  private readonly goal: number;
  private readonly reached = new Set<P["checkpoint"]>();
  private shown = 0; // the second the clock showed last
  private down = false; // a hit is playing out: from the hit until he moves again
  private stompedUntil = 0; // see STOMP_GRACE_MS
  private readonly handlers: Handlers<RunEvents<P>> = {};

  /** A level as its run needs it: where he starts, how many crystals and checkpoints it holds, the goal's x. */
  constructor(level: {
    start: { x: number; y: number };
    crystals: number;
    checkpoints: number;
    goal: number;
  }) {
    this.checkpoint = { x: level.start.x, y: level.start.y };
    this.totalCrystals = level.crystals;
    this.checkpoints = level.checkpoints;
    this.goal = level.goal;
  }

  /** Calls `handler` on every event of the type, in the order the handlers were added. */
  on<Type extends keyof RunEvents<P>>(type: Type, handler: (event: RunEvents<P>[Type]) => void) {
    const handlers: Handlers<RunEvents<P>>[Type] = this.handlers[type] ?? [];
    handlers.push(handler);
    this.handlers[type] = handlers;
  }

  private emit<Type extends keyof RunEvents<P>>(type: Type, event: RunEvents<P>[Type]) {
    for (const handler of this.handlers[type] ?? []) handler(event);
  }

  /** The run's time starts with his first move: started when he could move, it showed 0:03 before any key. */
  start(now: number) {
    if (this.startedAt === Infinity) this.startedAt = now;
  }

  /** A hidden tab stops the frames but not the clock: the time it was hidden is no run time. */
  skip(ms: number) {
    this.startedAt += ms;
  }

  /** The run's time in whole seconds; 0 before he moves, where a win showed "TIME -Infinity:NaN" and kept it. */
  seconds(now: number) {
    return Math.max(0, Math.round((now - this.startedAt) / 1000));
  }

  /** Called every frame: the second the clock shows, which stands still once the run has ended. */
  clock(now: number) {
    if (!this.won && !this.gameOver) this.shown = this.seconds(now);
    return this.shown;
  }

  /** Called every step: standing on the ground outside a dash ends the kill chain. */
  step(grounded: boolean, dashing: boolean) {
    if (chainEnds(grounded, dashing)) this.chain = 0;
  }

  collect(pickup: P["pickup"], secret: boolean) {
    if (secret) this.secret = true;
    else this.crystals++;
    this.emit("collected", { pickup, secret });
  }

  /** A heart refills one life, up to three. With all lives it stays where it is. */
  heal(pickup: P["pickup"]) {
    if (this.lives === LIVES) return;
    this.lives++;
    this.emit("healed", { pickup });
  }

  /** The wizard touches a bug: a stomp or a dash squishes it and scores, any other touch hurts him. */
  meet(bug: P["bug"], wizard: Moving, bugBody: Moving, dashing: boolean, now: number) {
    const stomp = isStomp(wizard, bugBody, now, this.stompedUntil);
    if (!killsBug(stomp, dashing))
      return this.hurt(false, Math.sign(wizard.center.x - bugBody.center.x), now);
    if (stomp) this.stompedUntil = now + STOMP_GRACE_MS;
    this.chain++;
    this.kills++;
    this.longestChain = Math.max(this.longestChain, this.chain);
    const points = chainPoints(this.chain);
    this.score += points;
    this.emit("squished", { bug, stomp, chain: this.chain, points });
  }

  /**
   * A hit costs a life, unless he still blinks from the last one. A fall into a pit always counts. While a hit plays
   * out, and after the win, nothing hits him.
   */
  hurt(fall: boolean, from: number, now: number) {
    if (this.won || this.down) return;
    if (!fall && now < this.invulnerableUntil) return;
    this.down = true;
    this.lives--;
    this.hits++;
    this.emit("hurt", { fall, from });
  }

  /** After a hit has played out: whether he goes on from the checkpoint. The last life ends the game, a win stands. */
  recover() {
    if (this.won) return false;
    if (this.lives !== 0) return true;
    this.gameOver = true;
    this.emit("gameOver", undefined);
    return false;
  }

  /** The hit is over: he blinks, and no touch hurts, from when he moves again. */
  shield(now: number) {
    this.down = false;
    this.invulnerableUntil = now + INVULNERABLE_MS;
  }

  /**
   * Called every frame for each checkpoint with the wizard's x: the first time he is past the checkpoint's x, he goes
   * on from (x, y) after a hit.
   */
  pass(checkpoint: P["checkpoint"], wizardX: number, x: number, y: number) {
    if (wizardX <= x || this.reached.has(checkpoint)) return;
    this.reached.add(checkpoint);
    this.checkpoint.x = x;
    this.checkpoint.y = y;
    this.emit("checkpoint", { checkpoint });
  }

  /** Whether he has passed every checkpoint, so the one he goes on from is the level's last. */
  get atLastCheckpoint() {
    return this.reached.size === this.checkpoints;
  }

  /**
   * Called every frame with the wizard's x: past the finish line the run is won, once, at the second the clock
   * showed last (read again at the win, it could round a second further). The awards replace the bug points as
   * the score.
   */
  arrive(x: number) {
    if (this.won || x <= this.goal - FINISH) return;
    this.won = true;
    const time = this.shown;
    const gold = earnsGold(time);
    const awards = winAwards(this, gold);
    this.score = awardTotal(awards);
    this.emit("won", { time, gold, awards });
  }
}
