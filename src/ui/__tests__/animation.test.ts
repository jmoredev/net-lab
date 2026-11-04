import { describe, expect, it } from 'vitest';
import { scene } from '../../domain/__tests__/helpers';
import { INTERNET_ID, moveDevice } from '../../domain/lab';
import type { Lab, Point } from '../../domain/types';
import {
  ROUND_TRIP_MS,
  pointAlong,
  roundTripProgress,
  routePolyline,
  routeSegments,
  type RouteSegment,
} from '../animation';
import { deviceCenter, portAnchorFor } from '../geometry';

function centreOf(lab: Lab, deviceId: string) {
  const device = lab.devices.find((candidate) => candidate.id === deviceId);
  if (!device) throw new Error(`unknown device ${deviceId}`);
  return deviceCenter(device);
}

function anchorOf(lab: Lab, deviceId: string, portId: string): Point {
  const anchor = portAnchorFor(lab, { deviceId, portId });
  if (!anchor) throw new Error(`no anchor for ${deviceId}/${portId}`);
  return anchor;
}

/** Every point the route visits, in order, anchors included. */
function pointsOf(segments: RouteSegment[]): Point[] {
  return segments.flatMap((segment) => [segment.from, segment.to]);
}

describe('routeSegments', () => {
  it('walks a wired laptop out of its eth port and into the Internet node', () => {
    const s = scene();
    const router = s.router();
    const laptop = s.add('laptop');
    s.plugWan();
    s.cable(laptop, 'eth', router, 'lan1');

    const segments = routeSegments(s.lab, laptop, INTERNET_ID);
    expect(segments).not.toBeNull();

    const eth = anchorOf(s.lab, laptop, 'eth');
    // The short stub out of the box, then the cable that leaves the real port (S23).
    expect(segments![0]).toEqual({ from: centreOf(s.lab, laptop), to: eth, medium: 'cable' });
    expect(segments![1].from).toEqual(eth);

    // No wireless hop at all: the cable dominates the whole route.
    const cable = segments!.filter((segment) => segment.medium === 'cable').length;
    const wifi = segments!.filter((segment) => segment.medium === 'wifi').length;
    expect(wifi).toBe(0);
    expect(cable).toBe(segments!.length);

    const points = pointsOf(segments!);
    expect(points).toContainEqual(anchorOf(s.lab, router, 'lan1'));
    expect(points).toContainEqual(anchorOf(s.lab, router, 'wan'));
    expect(points).toContainEqual(anchorOf(s.lab, INTERNET_ID, 'wan'));
    expect(segments![segments!.length - 1].to).toEqual(centreOf(s.lab, INTERNET_ID));
  });

  it('draws a WiFi hop as one centre-to-centre wireless segment', () => {
    const s = scene();
    const router = s.router();
    const phone = s.add('phone');
    const laptop = s.add('laptop');
    s.lab = moveDevice(s.lab, phone, { x: 120, y: 320 });
    s.lab = moveDevice(s.lab, laptop, { x: 640, y: 420 });
    s.wifi(phone);
    s.cable(laptop, 'eth', router, 'lan1');

    const segments = routeSegments(s.lab, phone, laptop);
    expect(segments).not.toBeNull();
    expect(segments!.filter((segment) => segment.medium === 'wifi')).toEqual([
      { from: centreOf(s.lab, phone), to: centreOf(s.lab, router), medium: 'wifi' },
    ]);
  });

  it('runs through both switch ports when the laptop sits behind a switch', () => {
    const s = scene();
    const router = s.router();
    const sw = s.add('switch');
    const laptop = s.add('laptop');
    s.plugWan();
    s.cable(laptop, 'eth', sw, 'p1');
    s.cable(sw, 'p8', router, 'lan1');

    const segments = routeSegments(s.lab, laptop, INTERNET_ID);
    expect(segments).not.toBeNull();

    const points = pointsOf(segments!);
    expect(points).toContainEqual(anchorOf(s.lab, sw, 'p1'));
    expect(points).toContainEqual(anchorOf(s.lab, sw, 'p8'));
    expect(points).toContainEqual(centreOf(s.lab, sw));
  });

  it('returns null when there is no route between the two devices', () => {
    const s = scene();
    s.router();
    const laptop = s.add('laptop');
    const desktop = s.add('desktop');

    expect(routeSegments(s.lab, laptop, desktop)).toBeNull();
  });
});

describe('routePolyline', () => {
  it('walks a wired laptop to the Internet node through the router', () => {
    const s = scene();
    const router = s.router();
    const laptop = s.add('laptop');
    s.plugWan();
    s.cable(laptop, 'eth', router, 'lan1');

    const points = routePolyline(s.lab, laptop, INTERNET_ID);
    expect(points).not.toBeNull();
    expect(points![0]).toEqual(centreOf(s.lab, laptop));
    expect(points![points!.length - 1]).toEqual(centreOf(s.lab, INTERNET_ID));
    expect(points).toContainEqual(anchorOf(s.lab, laptop, 'eth'));
    expect(points).toContainEqual(centreOf(s.lab, router));
  });

  it('walks a WiFi phone to a laptop through the router without repeating points', () => {
    const s = scene();
    const router = s.router();
    const phone = s.add('phone');
    const laptop = s.add('laptop');
    s.lab = moveDevice(s.lab, phone, { x: 120, y: 320 });
    s.lab = moveDevice(s.lab, laptop, { x: 640, y: 420 });
    s.wifi(phone);
    s.cable(laptop, 'eth', router, 'lan1');

    const points = routePolyline(s.lab, phone, laptop);
    expect(points).not.toBeNull();
    expect(points![0]).toEqual(centreOf(s.lab, phone));
    expect(points![points!.length - 1]).toEqual(centreOf(s.lab, laptop));
    const repeated = points!.slice(1).filter(
      (point, index) =>
        point.x === points![index].x && point.y === points![index].y,
    );
    expect(repeated).toEqual([]);
  });

  it('returns null when there is no route between the two devices', () => {
    const s = scene();
    s.router();
    const laptop = s.add('laptop');
    const desktop = s.add('desktop');

    expect(routePolyline(s.lab, laptop, desktop)).toBeNull();
  });
});

describe('roundTripProgress', () => {
  it('leaves at 0, arrives at 1 halfway and is back at 0 at the end', () => {
    expect(roundTripProgress(0, ROUND_TRIP_MS)).toBe(0);
    expect(roundTripProgress(ROUND_TRIP_MS / 2, ROUND_TRIP_MS)).toBe(1);
    expect(roundTripProgress(ROUND_TRIP_MS, ROUND_TRIP_MS)).toBe(0);
  });

  it('clamps outside the round trip', () => {
    expect(roundTripProgress(-120, ROUND_TRIP_MS)).toBe(0);
    expect(roundTripProgress(ROUND_TRIP_MS + 120, ROUND_TRIP_MS)).toBe(0);
    expect(roundTripProgress(Number.NaN, ROUND_TRIP_MS)).toBe(0);
  });
});

describe('pointAlong', () => {
  const polyline = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];

  it('is at the first point at 0 and at the last point at 1', () => {
    expect(pointAlong(polyline, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(polyline, 1)).toEqual({ x: 10, y: 10 });
  });

  it('interpolates the exact midpoint of a two-point segment', () => {
    expect(pointAlong([{ x: 0, y: 0 }, { x: 20, y: 40 }], 0.5)).toEqual({ x: 10, y: 20 });
  });

  it('keeps a constant speed across segments of different length', () => {
    // The first leg is 90 units long and the second one only 10, so a third of the
    // way along the distance is still inside the first leg.
    const uneven = [
      { x: 0, y: 0 },
      { x: 90, y: 0 },
      { x: 100, y: 0 },
    ];
    expect(pointAlong(uneven, 0.5)).toEqual({ x: 50, y: 0 });
    expect(pointAlong(uneven, 0.95)).toEqual({ x: 95, y: 0 });
  });

  it('does not break with an empty or single-point polyline', () => {
    expect(pointAlong([], 0.5)).toEqual({ x: 0, y: 0 });
    expect(pointAlong([{ x: 7, y: 9 }], 0.5)).toEqual({ x: 7, y: 9 });
    expect(pointAlong([{ x: 7, y: 9 }], 1)).toEqual({ x: 7, y: 9 });
  });
});
