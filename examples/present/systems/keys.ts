import type Phaser from "phaser";

/**
 * Listens for a key event on the scene's keyboard, taking each event once. Phaser 4.2.1 runs the frame's whole queue
 * of key events again on every new one and skips only a copy of the event just before: G pressed with another key,
 * that key down and up in the same frame, flipped the 18+ switch on and straight back off.
 */
export function onKey(scene: Phaser.Scene, name: string, handler: (event: KeyboardEvent) => void) {
  const seen = new WeakSet<KeyboardEvent>();
  scene.input.keyboard!.on(name, (event: KeyboardEvent) => {
    if (seen.has(event)) return;
    seen.add(event);
    handler(event);
  });
}
