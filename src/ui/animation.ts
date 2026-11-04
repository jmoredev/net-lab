import { getDevice, type Lab } from '../domain/lab';
import { findHops, type Hop } from '../domain/path';
import type { Point } from '../domain/types';
import { deviceCenter } from './geometry';

/** Total visible round trip of the packet (S23): out in half the time, back in the other half. */
export const ROUND_TRIP_MS = 2400;

/** A packet on its way from one device to another and back again. */
export interface Travel {
  from: string;
  to: string;
  hops: Hop[];
}

/**
 * The points the packet visits: the centre of the origin and then the centre of every
 * hop destination, so the marker runs over the real cables and devices of the route.
 * `null` when the two devices are not connected (S23: no route, no animation).
 */
export function routePolyline(lab: Lab, fromId: string, toId: string): Point[] | null {
  const hops = findHops(lab, fromId, toId);
  if (hops === null) return null;

  const origin = getDevice(lab, fromId);
  if (!origin) return null;

  const points: Point[] = [deviceCenter(origin)];
  for (const hop of hops) {
    const destination = getDevice(lab, hop.to);
    if (!destination) return null;
    points.push(deviceCenter(destination));
  }
  return points;
}

/**
 * Position of the packet inside the round trip: 0→1 on the way out, 1→0 on the way back,
 * so the visible trip ends exactly where it started.
 */
export function roundTripProgress(elapsedMs: number, totalMs: number): number {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(totalMs) || totalMs <= 0) return 0;
  if (elapsedMs <= 0 || elapsedMs >= totalMs) return 0;

  const half = totalMs / 2;
  return elapsedMs <= half ? elapsedMs / half : (totalMs - elapsedMs) / half;
}

/**
 * Point at fraction `t` of the polyline, measured by accumulated segment length so the
 * marker keeps a constant speed and never jumps on the short segments.
 */
export function pointAlong(points: Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };

  const clamped = Math.min(Math.max(t, 0), 1);
  const segments: number[] = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y,
    );
    segments.push(length);
    total += length;
  }
  if (total === 0) return { ...points[0] };

  let remaining = clamped * total;
  for (let index = 0; index < segments.length; index += 1) {
    const last = index === segments.length - 1;
    if (remaining <= segments[index] || last) {
      const ratio = segments[index] === 0 ? 0 : Math.min(remaining / segments[index], 1);
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio,
      };
    }
    remaining -= segments[index];
  }
  return { ...points[points.length - 1] };
}
