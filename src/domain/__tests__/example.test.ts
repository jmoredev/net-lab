import { describe, expect, it } from 'vitest';
import { computeStatus } from '../diagnostics';
import { createExampleLab } from '../example';
import { INTERNET_ID, type Lab } from '../lab';
import { CAPABILITIES, type Device } from '../types';

const CANVAS_WIDTH = 1240;
const CANVAS_HEIGHT = 800;
const DEVICE_SIZE = 88;
const MIN_GAP = 100;

const kindLabel = (device: Device): string => CAPABILITIES[device.kind].label;

/** Clients are the devices that take an address: laptop, desktop and phone. */
const clientsOf = (lab: Lab): Device[] => lab.devices.filter((device) => CAPABILITIES[device.kind].addressable);

const touches = (lab: Lab, deviceId: string): boolean =>
  lab.links.some((link) => link.a.deviceId === deviceId || link.b.deviceId === deviceId);

const isLinkedTo = (lab: Lab, a: string, b: string): boolean =>
  lab.links.some((link) => {
    const ids = [link.a.deviceId, link.b.deviceId];
    return ids.includes(a) && ids.includes(b);
  });

describe('example lab: S24 composition', () => {
  it('gives every client Internet access and no reason to complain', () => {
    const lab = createExampleLab();
    const statuses = computeStatus(lab);
    const clients = clientsOf(lab);

    expect(clients).toHaveLength(3);
    for (const client of clients) {
      expect(statuses[client.id].hasInternet).toBe(true);
      expect(statuses[client.id].reason).toBeNull();
    }
  });

  it('hands out .2, .3 and .4 in device order', () => {
    const lab = createExampleLab();
    const statuses = computeStatus(lab);

    expect(clientsOf(lab).map((client) => statuses[client.id].ip)).toEqual([
      '192.168.1.2',
      '192.168.1.3',
      '192.168.1.4',
    ]);
  });

  it('has exactly one switch, wired to the router', () => {
    const lab = createExampleLab();
    const switches = lab.devices.filter((device) => device.kind === 'switch');
    const routers = lab.devices.filter((device) => device.kind === 'router');

    expect(switches).toHaveLength(1);
    expect(routers).toHaveLength(1);
    expect(isLinkedTo(lab, switches[0].id, routers[0].id)).toBe(true);
  });

  it('associates both wireless clients with the WiFi of the router', () => {
    const lab = createExampleLab();
    const wireless = clientsOf(lab).filter((client) => !touches(lab, client.id));

    expect(wireless.map(kindLabel)).toEqual(['Portátil', 'Móvil']);
    expect(wireless.map((device) => device.name)).toEqual(['Portátil-2', 'Móvil-1']);
    for (const client of wireless) {
      expect(client.wifiAssociated).toBe(true);
    }
  });

  it('names every device differently and keeps the wired laptop on the switch', () => {
    const lab = createExampleLab();
    const names = lab.devices.map((device) => device.name);
    expect(new Set(names).size).toBe(lab.devices.length);

    const wiredLaptop = lab.devices.find((device) => device.name === 'Portátil-1');
    const netSwitch = lab.devices.find((device) => device.kind === 'switch');
    expect(wiredLaptop).toBeDefined();
    expect(netSwitch).toBeDefined();
    expect(isLinkedTo(lab, (wiredLaptop as Device).id, (netSwitch as Device).id)).toBe(true);
  });

  it('gives the router a WAN address through the cable to the Internet node', () => {
    const lab = createExampleLab();
    const router = lab.devices.find((device) => device.kind === 'router');

    expect(lab.router).not.toBeNull();
    expect(lab.router?.lanIp).toBe('192.168.1.1');
    expect(lab.router?.wanIp).toMatch(/^203\.0\.113\.\d+$/);
    expect(router).toBeDefined();
    expect(isLinkedTo(lab, (router as Device).id, INTERNET_ID)).toBe(true);
  });
});

describe('example lab: S24 layout', () => {
  it('keeps every box inside the canvas without overlaps', () => {
    const lab = createExampleLab();
    const placed = lab.devices.filter((device) => device.kind !== 'internet');

    for (const device of placed) {
      expect(device.position.x).toBeGreaterThanOrEqual(0);
      expect(device.position.y).toBeGreaterThanOrEqual(0);
      expect(device.position.x + DEVICE_SIZE).toBeLessThanOrEqual(CANVAS_WIDTH);
      expect(device.position.y + DEVICE_SIZE).toBeLessThanOrEqual(CANVAS_HEIGHT);
    }

    for (const [index, device] of placed.entries()) {
      for (const other of placed.slice(index + 1)) {
        const gapX = Math.abs(device.position.x - other.position.x);
        const gapY = Math.abs(device.position.y - other.position.y);
        expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(MIN_GAP);
      }
    }
  });

  it('puts the router above the switch and the wireless pair at the lower right', () => {
    const lab = createExampleLab();
    const byName = (name: string): Device => lab.devices.find((device) => device.name === name) as Device;

    expect(byName('Router').position.y).toBeLessThan(byName('Switch-1').position.y);
    expect(byName('Portátil-1').position.x).toBeLessThan(byName('Portátil-2').position.x);
    expect(byName('Portátil-1').position.x).toBeLessThan(byName('Móvil-1').position.x);
    expect(byName('Portátil-1').position.y).toBeGreaterThan(byName('Switch-1').position.y);
  });
});
