export const DEFAULT_CANVAS_W = 1100;
export const DEFAULT_CANVAS_H = 540;
export const MIN_CANVAS_W = 480;
export const MAX_CANVAS_W = 1800;
export const MIN_CANVAS_H = 280;
export const MAX_CANVAS_H = 1000;
export const MIN_ZONE_W = 120;
export const MIN_ZONE_H = 90;
export const GRID_STEP = 10;

export type ZoneResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type CanvasResizeHandle = 'e' | 's' | 'se';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function snapToGrid(value: number, step = GRID_STEP): number {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampZoneMove(
  orig: Rect,
  dx: number,
  dy: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const maxX = Math.max(0, canvasW - orig.width);
  const maxY = Math.max(0, canvasH - orig.height);
  return {
    x: clamp(snapToGrid(orig.x + dx), 0, maxX),
    y: clamp(snapToGrid(orig.y + dy), 0, maxY),
  };
}

export function computeZoneResize(
  orig: Rect,
  handle: ZoneResizeHandle,
  dx: number,
  dy: number,
  canvasW: number,
  canvasH: number,
): Rect {
  let { x, y, width, height } = orig;

  if (handle.includes('e')) {
    const maxW = Math.max(MIN_ZONE_W, canvasW - orig.x);
    width = clamp(snapToGrid(orig.width + dx), MIN_ZONE_W, maxW);
  }

  if (handle.includes('s')) {
    const maxH = Math.max(MIN_ZONE_H, canvasH - orig.y);
    height = clamp(snapToGrid(orig.height + dy), MIN_ZONE_H, maxH);
  }

  if (handle.includes('w')) {
    const right = orig.x + orig.width;
    const maxX = Math.max(0, right - MIN_ZONE_W);
    const nextX = clamp(snapToGrid(orig.x + dx), 0, maxX);
    x = nextX;
    width = right - nextX;
  }

  if (handle.includes('n')) {
    const bottom = orig.y + orig.height;
    const maxY = Math.max(0, bottom - MIN_ZONE_H);
    const nextY = clamp(snapToGrid(orig.y + dy), 0, maxY);
    y = nextY;
    height = bottom - nextY;
  }

  return { x, y, width, height };
}

export function computeMinCanvasSize(zonas: Rect[]): { minW: number; minH: number } {
  const maxRight = zonas.reduce((acc, z) => Math.max(acc, z.x + z.width), 0);
  const maxBottom = zonas.reduce((acc, z) => Math.max(acc, z.y + z.height), 0);
  return {
    minW: clamp(snapToGrid(maxRight + 20), MIN_CANVAS_W, MAX_CANVAS_W),
    minH: clamp(snapToGrid(maxBottom + 20), MIN_CANVAS_H, MAX_CANVAS_H),
  };
}

export function computeCanvasResize(
  origW: number,
  origH: number,
  handle: CanvasResizeHandle,
  dx: number,
  dy: number,
  minW: number,
  minH: number,
): { width: number; height: number } {
  const width =
    handle === 'e' || handle === 'se'
      ? clamp(snapToGrid(origW + dx), minW, MAX_CANVAS_W)
      : origW;
  const height =
    handle === 's' || handle === 'se'
      ? clamp(snapToGrid(origH + dy), minH, MAX_CANVAS_H)
      : origH;
  return { width, height };
}
