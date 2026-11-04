import { getDevice, type Lab } from '../domain/lab';
import type { Device, DeviceKind, Point, PortRef } from '../domain/types';
import { portLabel } from './format';

export const CANVAS = { width: 1240, height: 800 };
export const DEVICE_SIZE = 88;

/** Radius of the port dot drawn on the border of the device box (S32). */
export const PORT_RADIUS = 5;

const INTERNET_AT: Point = { x: CANVAS.width - 150, y: 40 };
const MARGIN = 48;
const STEP = DEVICE_SIZE + 56;
const COLUMNS = 5;
const ROWS = 4;
const TOP = 168;
const PORT_HIT_RADIUS = PORT_RADIUS * 3;

export type PortSide = 'left' | 'right' | 'top' | 'bottom';

/** A port drawn on the border of the device box, with the short name shown next to it. */
export interface PortAnchor {
  portId: string;
  side: PortSide;
  point: Point;
  /** Text shown next to the dot: `WAN`, `1`..`4`, `1`..`8`, `ETH` (S32). */
  label: string;
  /** Full port name: `WAN`, `LAN 1`, `Puerto 1`, `Ethernet`. */
  fullLabel: string;
}

interface Placement {
  portId: string;
  side: PortSide;
  /** Fraction along the edge, measured from the top-left corner of the box. */
  at: number;
  label: string;
}

const ROUTER_LAN_PORTS = [1, 2, 3, 4];
const SWITCH_PORTS = [1, 2, 3, 4, 5, 6, 7, 8];

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

/**
 * Ports of a device placed on the border of its box (S32). The layout is fixed per kind:
 * the router puts the WAN on top and the four LAN ports at the bottom, the switch splits
 * its eight ports between the left and the right edge, and the clients show one port.
 */
export function portAnchors(device: Device): PortAnchor[] {
  const position = renderPosition(device);
  return placementsOf(device.kind).map((placement) => ({
    portId: placement.portId,
    side: placement.side,
    label: placement.label,
    point: pointOnSide(position, placement.side, placement.at),
    fullLabel: portLabel(device, placement.portId),
  }));
}

/** Canvas point of one port, or `null` when that port does not exist. */
export function portAnchorFor(lab: Lab, port: PortRef): Point | null {
  const device = getDevice(lab, port.deviceId);
  if (!device) return null;
  const anchor = portAnchors(device).find((candidate) => candidate.portId === port.portId);
  return anchor ? { ...anchor.point } : null;
}

/** Nearest port to a canvas point, within `radius`; `null` when nothing is that close. */
export function findPortAt(lab: Lab, point: Point, radius: number = PORT_HIT_RADIUS): PortRef | null {
  let best: { ref: PortRef; distance: number } | null = null;
  for (const device of lab.devices) {
    for (const anchor of portAnchors(device)) {
      const distance = Math.hypot(anchor.point.x - point.x, anchor.point.y - point.y);
      if (distance > radius) continue;
      if (best === null || distance < best.distance) {
        best = { ref: { deviceId: device.id, portId: anchor.portId }, distance };
      }
    }
  }
  return best === null ? null : best.ref;
}

function placementsOf(kind: DeviceKind): Placement[] {
  switch (kind) {
    case 'router':
      return [
        { portId: 'wan', side: 'top', at: 0.5, label: 'WAN' },
        ...ROUTER_LAN_PORTS.map((number) => ({
          portId: `lan${number}`,
          side: 'bottom' as PortSide,
          at: number * 0.2,
          label: String(number),
        })),
      ];
    case 'switch':
      return SWITCH_PORTS.map((number, index) => ({
        portId: `p${number}`,
        side: (index < 4 ? 'left' : 'right') as PortSide,
        at: ((index % 4) + 1) * 0.2,
        label: String(number),
      }));
    case 'laptop':
    case 'desktop':
      return [{ portId: 'eth', side: 'left', at: 0.5, label: 'ETH' }];
    case 'internet':
      return [{ portId: 'wan', side: 'bottom', at: 0.5, label: 'WAN' }];
    case 'phone':
      return [];
  }
}

function pointOnSide(position: Point, side: PortSide, at: number): Point {
  switch (side) {
    case 'top':
      return { x: position.x + DEVICE_SIZE * at, y: position.y };
    case 'bottom':
      return { x: position.x + DEVICE_SIZE * at, y: position.y + DEVICE_SIZE };
    case 'left':
      return { x: position.x, y: position.y + DEVICE_SIZE * at };
    case 'right':
      return { x: position.x + DEVICE_SIZE, y: position.y + DEVICE_SIZE * at };
  }
}
