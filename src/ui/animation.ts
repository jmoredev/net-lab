import { getDevice, type Lab, type Link } from '../domain/lab';
import { findHops, type Hop } from '../domain/path';
import type { Point } from '../domain/types';
import { deviceCenter, portAnchorFor } from './geometry';

/** Total visible round trip of the packet (S23): out in half the time, back in the other half. */
export const ROUND_TRIP_MS = 2400;

/** A packet on its way from one device to another and back again. */
export interface Travel {
  from: string;
  to: string;
  hops: Hop[];
}

/** One leg of the drawn route: cable legs are solid, wireless legs fictitious and dotted (S23). */
export interface RouteSegment {
  from: Point;
  to: Point;
  medium: 'cable' | 'wifi';
}

/**
 * The legs of the route, with every cable entering and leaving through the real ports (S23).
 * Each link hop adds three cable legs (a short stub out of the origin box, the cable
 * between the two ports and a short stub into the destination box); a wireless hop adds a
 * single leg between the two centres, because there is no cable. `null` when the two
 * devices are not connected.
 */
export function routeSegments(lab: Lab, fromId: string, toId: string): RouteSegment[] | null {
  const hops = findHops(lab, fromId, toId);
  if (hops === null) return null;

  const origin = getDevice(lab, fromId);
  if (!origin) return null;

  const segments: RouteSegment[] = [];
  let previous = deviceCenter(origin);

  for (const hop of hops) {
    const destination = getDevice(lab, hop.to);
    if (!destination) return null;
    const destinationCenter = deviceCenter(destination);

    if (hop.via === 'wifi') {
      segments.push({ from: previous, to: destinationCenter, medium: 'wifi' });
      previous = destinationCenter;
      continue;
    }

    const link = hop.linkId === undefined
      ? undefined
      : lab.links.find((candidate) => candidate.id === hop.linkId);
    const source = getDevice(lab, hop.from);
    const sourceAnchor = anchorOfSide(lab, link, hop.from) ?? (source ? deviceCenter(source) : previous);
    const destinationAnchor = anchorOfSide(lab, link, hop.to) ?? destinationCenter;

    segments.push({ from: previous, to: sourceAnchor, medium: 'cable' });
    segments.push({ from: sourceAnchor, to: destinationAnchor, medium: 'cable' });
    segments.push({ from: destinationAnchor, to: destinationCenter, medium: 'cable' });
    previous = destinationCenter;
  }

  return segments;
}

/**
 * The points the packet visits, flattening the route legs (S23). Consecutive identical
 * points are dropped, so the marker never stops dead on a zero-length stretch.
 * `null` when the two devices are not connected (S23: no route, no animation).
 */
export function routePolyline(lab: Lab, fromId: string, toId: string): Point[] | null {
  const segments = routeSegments(lab, fromId, toId);
  if (segments === null) return null;

  if (segments.length === 0) {
    const origin = getDevice(lab, fromId);
    return origin ? [deviceCenter(origin)] : null;
  }

  const points: Point[] = [segments[0].from];
  for (const segment of segments) {
    const last = points[points.length - 1];
    if (last.x === segment.to.x && last.y === segment.to.y) continue;
    points.push(segment.to);
  }
  return points;
}

/** Canvas anchor of the port this link plugs into `deviceId`, or `null` when unresolvable. */
function anchorOfSide(lab: Lab, link: Link | undefined, deviceId: string): Point | null {
  if (!link) return null;
  const port = link.a.deviceId === deviceId ? link.a : link.b.deviceId === deviceId ? link.b : null;
  return port ? portAnchorFor(lab, port) : null;
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
