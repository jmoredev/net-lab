import { describe, expect, it } from 'vitest';
import { scene } from '../../domain/__tests__/helpers';
import { INTERNET_ID } from '../../domain/lab';
import type { Lab } from '../../domain/types';
import { ROUND_TRIP_MS, pointAlong, roundTripProgress, routePolyline } from '../animation';
import { deviceCenter } from '../geometry';

function centreOf(lab: Lab, deviceId: string) {
  const device = lab.devices.find((candidate) => candidate.id === deviceId);
  if (!device) throw new Error(`unknown device ${deviceId}`);
  return deviceCenter(device);
}

describe('routePolyline', () => {
  it('walks a wired laptop to the Internet node through the router', () => {
    const s = scene();
    const router = s.router();
    const laptop = s.add('laptop');
    s.plugWan();
    s.cable(laptop, 'eth', router, 'lan1');

    expect(routePolyline(s.lab, laptop, INTERNET_ID)).toEqual([
      centreOf(s.lab, laptop),
      centreOf(s.lab, router),
      centreOf(s.lab, INTERNET_ID),
    ]);
  });

  it('walks a WiFi phone to a laptop through the router', () => {
    const s = scene();
    const router = s.router();
    const phone = s.add('phone');
    const laptop = s.add('laptop');
    s.wifi(phone);
    s.cable(laptop, 'eth', router, 'lan1');

    expect(routePolyline(s.lab, phone, laptop)).toEqual([
      centreOf(s.lab, phone),
      centreOf(s.lab, router),
      centreOf(s.lab, laptop),
    ]);
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
