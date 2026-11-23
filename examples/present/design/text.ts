import Phaser from "phaser";

/** Makes a canvas's pixels fully opaque or transparent, so a pixel font stays crisp when scaled up. */
export function thresholdAlpha(context: CanvasRenderingContext2D) {
  const { width, height } = context.canvas;
  const pixels = context.getImageData(0, 0, width, height);
  for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i] < 128 ? 0 : 255;
  context.putImageData(pixels, 0, 0);
}

/**
 * Keeps a text 1-bit like the title's: the browser antialiases even this pixel font, which reads soft at 3 and
 * 6 times. Each time the text redraws its canvas (Phaser restores the context just before the upload), every
 * pixel turns fully on or off. After each upload the texture is sampled nearest again, as the upload resets it
 * to linear, and the text is exactly its canvas's size: the font's metrics made it 8.16 px tall on an 8 px canvas,
 * and the two together drew a grey line under every horizontal stroke.
 */
export function crisp(text: Phaser.GameObjects.Text) {
  const { canvas, context } = text;
  const restore = context.restore.bind(context);
  context.restore = () => {
    restore();
    if (!canvas.width || !canvas.height) return;
    thresholdAlpha(context);
  };
  const update = text.updateText.bind(text);
  text.updateText = () => {
    update();
    [text.width, text.height] = [canvas.width, canvas.height];
    text.frame.setSize(canvas.width, canvas.height);
    text.updateDisplayOrigin().texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return text;
  };
  return text.updateText();
}
