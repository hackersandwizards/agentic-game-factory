type Edges = { left: number; right: number; top: number; bottom: number };
export type LineRoom = {
  top: number;
  bottom: number;
  hint?: Edges & { above: boolean };
};

export function lineLimit(room: LineRoom, x: number, width: number, top: boolean) {
  const edge = top ? room.top : room.bottom;
  const hint = room.hint;
  if (hint && hint.above === top && x - width / 2 < hint.right && hint.left < x + width / 2)
    return top ? Math.max(edge, hint.bottom) : Math.min(edge, hint.top);
  return edge;
}

type Line = {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
  beside: number;
  across: number;
};

export function findLinePlacement(line: Line, obstacles: readonly Edges[], room: LineRoom) {
  const { x: x0, y: y0, width: w, height: h, left, right } = line;
  const fit = (x: number, dir: number) => {
    const top = lineLimit(room, x, w, true);
    const bottom = lineLimit(room, x, w, false);
    let y = Math.max(y0, top + h);
    for (let i = 0; i <= obstacles.length; i++) {
      const hit = obstacles.find(
        (o) => x - w / 2 < o.right && o.left < x + w / 2 && y - h < o.bottom && o.top < y,
      );
      if (!hit) return y - h >= top && y <= bottom ? y : undefined;
      y = dir < 0 ? hit.top - 4 : hit.bottom + 4 + h;
    }
    return undefined;
  };
  for (const at of [x0, line.beside, line.across]) {
    const x = Math.max(left, Math.min(right, at));
    const y = fit(x, -1) ?? fit(x, 1);
    if (y !== undefined) return { x, y };
  }
  const x = Math.max(left, Math.min(right, x0));
  return { x, y: Math.max(y0, lineLimit(room, x, w, true) + h) };
}
