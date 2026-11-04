import { describe, expect, it } from 'vitest';
import { INTERNET_ID, addDevice, createLab, type Lab } from '../../domain/lab';
import { CAPABILITIES, type Device, type DeviceKind, type Point } from '../../domain/types';
import {
  DEVICE_SIZE,
  PORT_RADIUS,
  deviceCenter,
  findPortAt,
  internetPosition,
  nextFreePosition,
  portAnchorFor,
  portAnchors,
  renderPosition,
  type PortSide,
} from '../geometry';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

/** Adds one device and returns the lab with it, so anchors are measured on a real lab. */
function place(kind: DeviceKind, position: Point): { lab: Lab; device: Device } {
  // The Internet node always exists and cannot be added (S27).
  if (kind === 'internet') {
    const lab = createLab();
    return { lab, device: lab.devices[0] };
  }
  const lab = unwrap(addDevice(createLab(), kind, position));
  return { lab, device: lab.devices[lab.devices.length - 1] };
}

describe('geometry', () => {
  it('centres a device box on its position', () => {
    const device = { position: { x: 100, y: 50 } } as never;
    expect(deviceCenter(device)).toEqual({ x: 100 + DEVICE_SIZE / 2, y: 50 + DEVICE_SIZE / 2 });
  });

  it('keeps the Internet node at its own fixed place', () => {
    const lab = createLab();
    const internet = lab.devices[0];
    expect(renderPosition(internet)).toEqual(internetPosition());
    expect(internetPosition().x).not.toBe(renderPosition({ ...internet, position: { x: 5, y: 5 } }).x - 5);
  });

  it('places a new device in the first free slot and never on top of another', () => {
    let lab = createLab();
    const first = nextFreePosition(lab);
    lab = unwrap(addDevice(lab, 'laptop', first));
    const second = nextFreePosition(lab);
    expect(second).not.toEqual(first);

    const tooClose = lab.devices.some(
      (device) =>
        Math.abs(renderPosition(device).x - second.x) < DEVICE_SIZE &&
        Math.abs(renderPosition(device).y - second.y) < DEVICE_SIZE,
    );
    expect(tooClose).toBe(false);
  });
});

describe('geometry: port anchors (S32)', () => {
  const POSITION = { x: 100, y: 60 };

  const expectedSides: { kind: DeviceKind; sides: [string, PortSide][] }[] = [
    {
      kind: 'router',
      sides: [
        ['wan', 'top'],
        ['lan1', 'bottom'],
        ['lan2', 'bottom'],
        ['lan3', 'bottom'],
        ['lan4', 'bottom'],
      ],
    },
    {
      kind: 'switch',
      sides: [
        ['p1', 'left'],
        ['p2', 'left'],
        ['p3', 'left'],
        ['p4', 'left'],
        ['p5', 'right'],
        ['p6', 'right'],
        ['p7', 'right'],
        ['p8', 'right'],
      ],
    },
    { kind: 'laptop', sides: [['eth', 'left']] },
    { kind: 'desktop', sides: [['eth', 'left']] },
    { kind: 'internet', sides: [['wan', 'bottom']] },
    { kind: 'phone', sides: [] },
  ];

  it('gives every kind its ports, each one on its documented side', () => {
    for (const { kind, sides } of expectedSides) {
      const { device } = place(kind, POSITION);
      const anchors = portAnchors(device);
      expect(anchors.map((anchor) => anchor.portId)).toEqual(CAPABILITIES[kind].ports);
      expect(anchors.map((anchor) => [anchor.portId, anchor.side])).toEqual(sides);
      expect(anchors).toHaveLength(sides.length);
    }
  });

  it('shows the short name next to the dot and the full name in the tooltip', () => {
    const { device: router } = place('router', POSITION);
    expect(portAnchors(router).map((anchor) => anchor.label)).toEqual(['WAN', '1', '2', '3', '4']);
    expect(portAnchors(router).find((anchor) => anchor.portId === 'lan2')?.fullLabel).toBe('LAN 2');

    const { device: switchDevice } = place('switch', POSITION);
    expect(portAnchors(switchDevice).map((anchor) => anchor.label)).toEqual([
      '1', '2', '3', '4', '5', '6', '7', '8',
    ]);
    expect(portAnchors(switchDevice).find((anchor) => anchor.portId === 'p7')?.fullLabel).toBe('Puerto 7');

    const { device: laptop } = place('laptop', POSITION);
    expect(portAnchors(laptop).map((anchor) => [anchor.label, anchor.fullLabel])).toEqual([['ETH', 'Ethernet']]);

    const { device: internet } = place('internet', POSITION);
    expect(portAnchors(internet).map((anchor) => [anchor.label, anchor.fullLabel])).toEqual([['WAN', 'WAN']]);
  });

  it('spreads the four router LAN ports evenly along the bottom edge', () => {
    const { device: router } = place('router', POSITION);
    const lan = portAnchors(router).filter((anchor) => anchor.side === 'bottom');
    const expectedX = [0.2, 0.4, 0.6, 0.8].map((fraction) => POSITION.x + DEVICE_SIZE * fraction);

    expect(lan.map((anchor) => anchor.point.x)).toEqual(expectedX);
    expect(lan.every((anchor) => anchor.point.y === POSITION.y + DEVICE_SIZE)).toBe(true);
    // Same gap between neighbours: 20% of the box.
    const gaps = lan.slice(1).map((anchor, index) => anchor.point.x - lan[index].point.x);
    for (const gap of gaps) expect(gap).toBeCloseTo(DEVICE_SIZE * 0.2);

    const wan = portAnchors(router).find((anchor) => anchor.portId === 'wan');
    expect(wan?.point).toEqual({ x: POSITION.x + DEVICE_SIZE / 2, y: POSITION.y });
  });

  it('splits the switch ports four and four between left and right', () => {
    const { device: switchDevice } = place('switch', POSITION);
    const anchors = portAnchors(switchDevice);
    const left = anchors.filter((anchor) => anchor.side === 'left');
    const right = anchors.filter((anchor) => anchor.side === 'right');

    expect(left.map((anchor) => anchor.portId)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(right.map((anchor) => anchor.portId)).toEqual(['p5', 'p6', 'p7', 'p8']);
    expect(left.every((anchor) => anchor.point.x === POSITION.x)).toBe(true);
    expect(right.every((anchor) => anchor.point.x === POSITION.x + DEVICE_SIZE)).toBe(true);
    expect(left.map((anchor) => anchor.point.y)).toEqual(right.map((anchor) => anchor.point.y));
  });

  it('puts the single client port in the middle of the left edge', () => {
    const { device: laptop } = place('laptop', POSITION);
    expect(portAnchors(laptop)[0].point).toEqual({
      x: POSITION.x,
      y: POSITION.y + DEVICE_SIZE / 2,
    });
  });

  it('finds the canvas point of one port and reports the ones that do not exist', () => {
    const { lab, device: router } = place('router', POSITION);
    const anchor = portAnchors(router).find((candidate) => candidate.portId === 'lan3');

    expect(portAnchorFor(lab, { deviceId: router.id, portId: 'lan3' })).toEqual(anchor?.point);
    expect(portAnchorFor(lab, { deviceId: router.id, portId: 'p1' })).toBeNull();
    expect(portAnchorFor(lab, { deviceId: 'unknown', portId: 'lan3' })).toBeNull();
  });
});

describe('geometry: findPortAt', () => {
  const POSITION = { x: 100, y: 60 };

  it('resolves a point one hit radius away from a dot', () => {
    const { lab, device: router } = place('router', POSITION);
    const lan1 = portAnchors(router).find((anchor) => anchor.portId === 'lan1');
    if (!lan1) throw new Error('lan1 is missing');

    const nearby = { x: lan1.point.x, y: lan1.point.y + PORT_RADIUS * 3 };
    expect(findPortAt(lab, nearby)).toEqual({ deviceId: router.id, portId: 'lan1' });
    expect(findPortAt(lab, nearby, PORT_RADIUS)).toBeNull();
  });

  it('returns null far away from every port', () => {
    const { lab } = place('router', POSITION);
    expect(findPortAt(lab, { x: 900, y: 700 })).toBeNull();
  });

  it('returns null for a phone, which has no Ethernet port', () => {
    const phone = place('phone', POSITION);
    const centre = deviceCenter(phone.device);
    expect(findPortAt(phone.lab, centre)).toBeNull();
  });

  it('never answers with the Internet node port when the pointer is next to the switch', () => {
    const { lab, device: placed } = place('switch', { x: 900, y: 40 });
    const p5 = portAnchors(placed).find((anchor) => anchor.portId === 'p5');
    if (!p5) throw new Error('p5 is missing');

    const found = findPortAt(lab, { x: p5.point.x + 2, y: p5.point.y + 2 });
    expect(found).toEqual({ deviceId: placed.id, portId: 'p5' });
    expect(found?.deviceId).not.toBe(INTERNET_ID);

    // The phone next to the Internet node also resolves to nothing, not to the WAN port.
    const withPhone = unwrap(addDevice(lab, 'phone', { x: internetPosition().x, y: internetPosition().y + 140 }));
    const phone = withPhone.devices[withPhone.devices.length - 1];
    expect(findPortAt(withPhone, deviceCenter(phone))).toBeNull();
  });
});
