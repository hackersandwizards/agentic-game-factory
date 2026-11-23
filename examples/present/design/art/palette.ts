import { COLOR } from "../tokens";

// One string per row of pixels, one colour per character: the QR code, HUD and touch icons,
// snow, dust, sparks and confetti are drawn from these colours of the palette (design/tokens.ts).
export const PALETTE: Record<string, string> = {
  o: COLOR.outline,
  w: COLOR.snow,
  i: COLOR.snowShade,
  x: COLOR.crystal,
  X: COLOR.crystalLight,
  e: COLOR.red,
  a: COLOR.amber,
  p: COLOR.purple,
  g: COLOR.green,
  f: COLOR.footprint,
  r: COLOR.blood,
  R: COLOR.bloodLight,
  k: COLOR.bloodDark,
};
