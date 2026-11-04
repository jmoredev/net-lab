import type { Lab } from '../domain/lab';
import type { Device, Point } from '../domain/types';

export const CANVAS = { width: 1240, height: 800 };
export const DEVICE_SIZE = 88;

const INTERNET_AT: Point = { x: CANVAS.width - 150, y: 40 };
const MARGIN = 48;
const STEP = DEVICE_SIZE + 56;
const COLUMNS = 5;
const ROWS = 4;
const TOP = 168;

/** The Internet node keeps its own fixed place on the canvas and is not draggable. */
export function internetPosition(): Point {
  return { ...INTERNET_AT };
}

export function renderPosition(device: Device): Point {
  return device.kind === 'internet' ? internetPosition() : device.position;
}

export function deviceCenter(device: Device): Point {
  const position = renderPosition(device);
  return { x: position.x + DEVICE_SIZE / 2, y: position.y + DEVICE_SIZE / 2 };
}

export function clampPosition(position: Point): Point {
  return {
    x: Math.min(Math.max(position.x, 8), CANVAS.width - DEVICE_SIZE - 8),
    y: Math.min(Math.max(position.y, 8), CANVAS.height - DEVICE_SIZE - 8),
  };
}

/** First grid slot that does not overlap an existing device. */
export function nextFreePosition(lab: Lab): Point {
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const candidate = { x: MARGIN + column * STEP, y: TOP + row * STEP };
      if (isFree(lab, candidate)) return candidate;
    }
  }
  return { x: MARGIN, y: TOP };
}

function isFree(lab: Lab, candidate: Point): boolean {
  return lab.devices.every((device) => {
    const position = renderPosition(device);
    return Math.abs(position.x - candidate.x) >= DEVICE_SIZE || Math.abs(position.y - candidate.y) >= DEVICE_SIZE;
  });
}
