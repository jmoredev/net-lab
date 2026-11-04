import { getDevice, type Lab } from './lab';
import type { Device } from './types';

export interface Hop {
  from: string;
  to: string;
  via: 'link' | 'wifi';
  linkId?: string;
}

interface Edge {
  to: string;
  via: 'link' | 'wifi';
  linkId?: string;
}

/** Shortest route between two devices, following cables and WiFi associations. */
export function findHops(lab: Lab, fromId: string, toId: string): Hop[] | null {
  if (fromId === toId) return [];
  if (!getDevice(lab, fromId) || !getDevice(lab, toId)) return null;

  const parents = new Map<string, { from: string; via: 'link' | 'wifi'; linkId?: string }>();
  const visited = new Set<string>([fromId]);
  const queue = [fromId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of edgesOf(lab, current)) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      parents.set(edge.to, { from: current, via: edge.via, linkId: edge.linkId });
      if (edge.to === toId) return reconstruct(parents, fromId, toId);
      queue.push(edge.to);
    }
  }
  return null;
}

function edgesOf(lab: Lab, deviceId: string): Edge[] {
  const edges: Edge[] = [];
  for (const link of lab.links) {
    if (link.a.deviceId === deviceId) edges.push({ to: link.b.deviceId, via: 'link', linkId: link.id });
    else if (link.b.deviceId === deviceId) edges.push({ to: link.a.deviceId, via: 'link', linkId: link.id });
  }

  const routerDevice = lab.router ? getDevice(lab, lab.router.deviceId) : undefined;
  if (routerDevice?.wifiEnabled) {
    const device = getDevice(lab, deviceId) as Device | undefined;
    if (device && device.id !== routerDevice.id && device.wifiAssociated && device.wifiEnabled) {
      edges.push({ to: routerDevice.id, via: 'wifi' });
    }
    if (deviceId === routerDevice.id) {
      for (const candidate of lab.devices) {
        if (candidate.id === routerDevice.id) continue;
        if (candidate.wifiAssociated && candidate.wifiEnabled) {
          edges.push({ to: candidate.id, via: 'wifi' });
        }
      }
    }
  }
  return edges;
}

function reconstruct(
  parents: Map<string, { from: string; via: 'link' | 'wifi'; linkId?: string }>,
  fromId: string,
  toId: string,
): Hop[] {
  const hops: Hop[] = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const parent = parents.get(cursor);
    if (!parent) return [];
    hops.unshift({ from: parent.from, to: cursor, via: parent.via, linkId: parent.linkId });
    cursor = parent.from;
  }
  return hops;
}
