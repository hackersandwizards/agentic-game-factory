import { POINTS } from "./score";

export const LIVES = 3;
export const INVULNERABLE_MS = 1000; // a hit cannot hurt again while the wizard blinks
// A stomp's grace: another bug he was above before the step, touched in the same step or in this many ms after a
// stomp, is a stomp too. The first stomp's bounce turned his fall upward, and the second bug then hurt him.
export const STOMP_GRACE_MS = 100;
// A hit plays out this long, he spinning and fading where it took him, before he goes on from the checkpoint.
export const HIT_MS = 400;

type Motion = { prev: { y: number }; velocity: { y: number } };

export function isStomp(body: Motion & { height: number }, bug: Motion, now: number, graceUntil: number) {
  // A stomp: the wizard's feet were above the bug's top before this physics step. Comparing the
  // previous positions holds at any speed, also when a hopping bug rises into a falling wizard.
  // Within a stomp's grace (STOMP_GRACE_MS) only the feet count.
  const above = body.prev.y + body.height <= bug.prev.y + 4;
  return above && (body.velocity.y > bug.velocity.y || now <= graceUntil);
}

export function killsBug(stomp: boolean, dashing: boolean) {
  return stomp || dashing;
}

export function chainEnds(grounded: boolean, dashing: boolean) {
  return grounded && !dashing;
}

// Each kill in a chain is worth one more hundred.
export function chainPoints(chain: number) {
  return POINTS.kill * chain;
}
