import { describe, expect, it } from 'vitest';
import {
  INTERNET_ID,
  addDevice,
  connectCable,
  createLab,
  deleteDevice,
  disconnectCable,
  getDevice,
  moveDevice,
  portIsFree,
  renameDevice,
  setWifiEnabled,
  type Lab,
} from '../lab';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!result.ok) throw new Error(`expected ok, got error: ${result.error}`);
  return result.value;
};

function labWithRouter(): { lab: Lab; routerId: string } {
  const lab = unwrap(addDevice(createLab(), 'router', { x: 100, y: 100 }));
  const router = lab.devices.find((d) => d.kind === 'router')!;
  return { lab, routerId: router.id };
}

describe('lab: initial state', () => {
  it('starts empty except for the fixed Internet node', () => {
    const lab = createLab();
    expect(lab.devices).toHaveLength(1);
    expect(lab.devices[0].id).toBe(INTERNET_ID);
    expect(lab.devices[0].kind).toBe('internet');
    expect(lab.links).toHaveLength(0);
    expect(lab.router).toBeNull();
  });
});

describe('lab: adding devices', () => {
  it('creates router settings with the agreed defaults', () => {
    const { lab } = labWithRouter();
    expect(lab.router).toMatchObject({
      lanIp: '192.168.1.1',
      dhcpStart: 2,
      dhcpEnd: 100,
      ssid: 'Net-Lab',
      wanIp: null,
    });
  });

  it('numbers default names per kind', () => {
    const lab = unwrap(addDevice(createLab(), 'laptop', { x: 0, y: 0 }));
    const lab2 = unwrap(addDevice(lab, 'laptop', { x: 0, y: 0 }));
    expect(lab2.devices.map((d) => d.name)).toContain('Laptop-1');
    expect(lab2.devices.map((d) => d.name)).toContain('Laptop-2');
  });

  it('gives each device a MAC except the Internet node', () => {
    const lab = unwrap(addDevice(createLab(), 'desktop', { x: 0, y: 0 }));
    const desktop = lab.devices.find((d) => d.kind === 'desktop')!;
    expect(desktop.mac).toMatch(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/);
    expect(lab.devices.find((d) => d.id === INTERNET_ID)!.mac).toBeNull();
  });

  it('applies the capability matrix to interface defaults', () => {
    const lab = unwrap(addDevice(createLab(), 'phone', { x: 0, y: 0 }));
    const phone = getDevice(lab, lab.devices[1].id)!;
    expect(phone.ethernetEnabled).toBe(false);
    expect(phone.wifiEnabled).toBe(true);

    const lab2 = unwrap(addDevice(createLab(), 'desktop', { x: 0, y: 0 }));
    const desktop = getDevice(lab2, lab2.devices[1].id)!;
    expect(desktop.ethernetEnabled).toBe(true);
    expect(desktop.wifiEnabled).toBe(false);
  });

  it('allows only one router per lab', () => {
    const { lab } = labWithRouter();
    const result = addDevice(lab, 'router', { x: 0, y: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Ya hay un router en el laboratorio.');
  });
});

describe('lab: renaming and deleting', () => {
  it('renames a device', () => {
    const { lab } = labWithRouter();
    const renamed = unwrap(renameDevice(lab, lab.devices[1].id, 'Router del aula'));
    expect(getDevice(renamed, renamed.devices[1].id)!.name).toBe('Router del aula');
  });

  it('rejects an empty name', () => {
    const { lab } = labWithRouter();
    const result = renameDevice(lab, lab.devices[1].id, '   ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('El nombre no puede estar vacío.');
  });

  it('rejects a duplicate name', () => {
    const { lab } = labWithRouter();
    const result = renameDevice(lab, lab.devices[1].id, 'Internet');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Ya hay un dispositivo llamado Internet.');
  });

  it('deleting a device removes its cables and frees the ports', () => {
    const { lab, routerId } = labWithRouter();
    const withLaptop = unwrap(addDevice(lab, 'laptop', { x: 0, y: 0 }));
    const laptopId = withLaptop.devices.find((d) => d.kind === 'laptop')!.id;
    const cable = unwrap(
      connectCable(withLaptop, { deviceId: laptopId, portId: 'eth' }, { deviceId: routerId, portId: 'lan1' }),
    );
    const removed = unwrap(deleteDevice(cable, laptopId));
    expect(removed.links).toHaveLength(0);
    expect(portIsFree(removed, routerId, 'lan1')).toBe(true);
  });

  it('never deletes the Internet node', () => {
    const result = deleteDevice(createLab(), INTERNET_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('El nodo Internet no se puede eliminar.');
  });

  it('deleting the router clears the addressing plan', () => {
    const { lab, routerId } = labWithRouter();
    const removed = unwrap(deleteDevice(lab, routerId));
    expect(removed.router).toBeNull();
  });

  it('moves a device', () => {
    const { lab, routerId } = labWithRouter();
    const moved = moveDevice(lab, routerId, { x: 400, y: 250 });
    expect(getDevice(moved, routerId)!.position).toEqual({ x: 400, y: 250 });
  });
});

describe('lab: cables', () => {
  it('connects a laptop to a free router LAN port', () => {
    const { lab, routerId } = labWithRouter();
    const withLaptop = unwrap(addDevice(lab, 'laptop', { x: 0, y: 0 }));
    const laptopId = withLaptop.devices.find((d) => d.kind === 'laptop')!.id;
    const linked = unwrap(
      connectCable(withLaptop, { deviceId: laptopId, portId: 'eth' }, { deviceId: routerId, portId: 'lan1' }),
    );
    expect(linked.links).toHaveLength(1);
    expect(portIsFree(linked, routerId, 'lan1')).toBe(false);
  });

  it('rejects an occupied port', () => {
    const { lab, routerId } = labWithRouter();
    const one = unwrap(addDevice(lab, 'laptop', { x: 0, y: 0 }));
    const laptopA = one.devices.find((d) => d.kind === 'laptop')!.id;
    const two = unwrap(addDevice(one, 'desktop', { x: 0, y: 0 }));
    const desktop = two.devices.find((d) => d.kind === 'desktop')!.id;
    const linked = unwrap(
      connectCable(two, { deviceId: laptopA, portId: 'eth' }, { deviceId: routerId, portId: 'lan1' }),
    );
    const result = connectCable(linked, { deviceId: desktop, portId: 'eth' }, { deviceId: routerId, portId: 'lan1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Ese puerto ya está ocupado.');
  });

  it('rejects any cable on a phone', () => {
    const lab = unwrap(addDevice(createLab(), 'phone', { x: 0, y: 0 }));
    const phoneId = lab.devices[1].id;
    const result = connectCable(lab, { deviceId: phoneId, portId: 'eth' }, { deviceId: INTERNET_ID, portId: 'wan' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Un móvil no admite cable: solo se conecta por WiFi.');
  });

  it('only wires the Internet node to the router WAN port', () => {
    const { lab } = labWithRouter();
    const withLaptop = unwrap(addDevice(lab, 'laptop', { x: 0, y: 0 }));
    const laptopId = withLaptop.devices.find((d) => d.kind === 'laptop')!.id;
    const result = connectCable(withLaptop, { deviceId: laptopId, portId: 'eth' }, { deviceId: INTERNET_ID, portId: 'wan' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('El nodo Internet solo se conecta al puerto WAN del router.');
  });

  it('allows a cable between two end devices', () => {
    const lab = unwrap(addDevice(createLab(), 'laptop', { x: 0, y: 0 }));
    const two = unwrap(addDevice(lab, 'desktop', { x: 0, y: 0 }));
    const laptopId = two.devices.find((d) => d.kind === 'laptop')!.id;
    const desktopId = two.devices.find((d) => d.kind === 'desktop')!.id;
    const result = connectCable(two, { deviceId: laptopId, portId: 'eth' }, { deviceId: desktopId, portId: 'eth' });
    expect(result.ok).toBe(true);
  });

  it('disconnecting frees both ports', () => {
    const { lab, routerId } = labWithRouter();
    const withLaptop = unwrap(addDevice(lab, 'laptop', { x: 0, y: 0 }));
    const laptopId = withLaptop.devices.find((d) => d.kind === 'laptop')!.id;
    const linked = unwrap(
      connectCable(withLaptop, { deviceId: laptopId, portId: 'eth' }, { deviceId: routerId, portId: 'lan1' }),
    );
    const cut = unwrap(disconnectCable(linked, linked.links[0].id));
    expect(cut.links).toHaveLength(0);
    expect(portIsFree(cut, laptopId, 'eth')).toBe(true);
    expect(portIsFree(cut, routerId, 'lan1')).toBe(true);
  });
});

describe('lab: router WiFi', () => {
  it('turning the router WiFi off drops every wireless client association', () => {
    const { lab } = labWithRouter();
    const withPhone = unwrap(addDevice(lab, 'phone', { x: 0, y: 0 }));
    const phoneId = withPhone.devices.find((d) => d.kind === 'phone')!.id;
    const associated = withPhone.devices.map((d) => (d.id === phoneId ? { ...d, wifiAssociated: true } : d));
    const off = unwrap(setWifiEnabled({ ...withPhone, devices: associated }, withPhone.router!.deviceId, false));
    expect(getDevice(off, phoneId)!.wifiAssociated).toBe(false);
  });
});
