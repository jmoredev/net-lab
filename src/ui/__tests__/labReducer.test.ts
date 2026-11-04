import { describe, expect, it } from 'vitest';
import { INTERNET_ID, addDevice, createLab } from '../../domain/lab';
import { initialLabState, labReducer } from '../labReducer';

describe('labReducer: adding devices', () => {
  it('adds a device, selects it and keeps the message clean', () => {
    const state = labReducer(initialLabState(), { type: 'add-device', kind: 'laptop', position: { x: 10, y: 10 } });
    expect(state.lab.devices).toHaveLength(2);
    expect(state.selectedId).toBe(state.lab.devices[1].id);
    expect(state.message).toBeNull();
  });

  it('refuses a second router with the domain message and changes nothing', () => {
    let state = labReducer(initialLabState(), { type: 'add-device', kind: 'router', position: { x: 10, y: 10 } });
    const before = state.lab;
    state = labReducer(state, { type: 'add-device', kind: 'router', position: { x: 90, y: 10 } });
    expect(state.message).toBe('Ya hay un router en el laboratorio.');
    expect(state.lab).toBe(before);
  });
});

describe('labReducer: editing', () => {
  it('renames and reports an empty name without touching the device', () => {
    let state = labReducer(initialLabState(), { type: 'add-device', kind: 'laptop', position: { x: 10, y: 10 } });
    const id = state.selectedId as string;

    state = labReducer(state, { type: 'rename-device', id, name: 'Equipo de Ana' });
    expect(state.lab.devices.find((device) => device.id === id)?.name).toBe('Equipo de Ana');

    state = labReducer(state, { type: 'rename-device', id, name: '  ' });
    expect(state.message).toBe('El nombre no puede estar vacío.');
    expect(state.lab.devices.find((device) => device.id === id)?.name).toBe('Equipo de Ana');
  });

  it('moves a device without dropping the selection', () => {
    let state = labReducer(initialLabState(), { type: 'add-device', kind: 'laptop', position: { x: 10, y: 10 } });
    const id = state.selectedId as string;
    state = labReducer(state, { type: 'move-device', id, position: { x: 200, y: 120 } });
    expect(state.lab.devices.find((device) => device.id === id)?.position).toEqual({ x: 200, y: 120 });
    expect(state.selectedId).toBe(id);
  });

  it('clears the selection when the selected device is deleted', () => {
    let state = labReducer(initialLabState(), { type: 'add-device', kind: 'laptop', position: { x: 10, y: 10 } });
    const id = state.selectedId as string;
    state = labReducer(state, { type: 'delete-device', id });
    expect(state.selectedId).toBeNull();
    expect(state.lab.devices.some((device) => device.id === id)).toBe(false);
  });

  it('never deletes the Internet node from the canvas', () => {
    const state = labReducer(initialLabState(), { type: 'delete-device', id: INTERNET_ID });
    expect(state.message).toBe('El nodo Internet no se puede eliminar.');
    expect(state.lab.devices).toHaveLength(1);
  });

  it('dismissing clears the message', () => {
    const state = labReducer(initialLabState(), { type: 'delete-device', id: INTERNET_ID });
    expect(labReducer(state, { type: 'dismiss-message' }).message).toBeNull();
  });
});

describe('labReducer: loading a lab (S24)', () => {
  it('replaces the lab and clears the selection and the message', () => {
    const { state } = wiredState();
    const linkId = state.lab.links[0].id;
    let dirty = labReducer(state, { type: 'select-link', linkId });
    dirty = labReducer(dirty, { type: 'delete-device', id: INTERNET_ID });
    expect(dirty.selectedId).not.toBeNull();
    expect(dirty.selectedLinkId).toBe(linkId);
    expect(dirty.message).toBe('El nodo Internet no se puede eliminar.');

    const example = addDevice(createLab(), 'switch', { x: 480, y: 320 });
    if (!example.ok) throw new Error(example.error);
    const loaded = labReducer(dirty, { type: 'load', lab: example.value });

    expect(loaded).not.toBe(dirty);
    expect(loaded.lab).toBe(example.value);
    expect(loaded.selectedId).toBeNull();
    expect(loaded.selectedLinkId).toBeNull();
    expect(loaded.hoveredId).toBeNull();
    expect(loaded.message).toBeNull();
  });
});

describe('labReducer: connections', () => {
  it('connects, then disconnects a cable', () => {
    let state = labReducer(initialLabState(), { type: 'add-device', kind: 'router', position: { x: 10, y: 10 } });
    const routerId = state.selectedId as string;
    state = labReducer(state, { type: 'add-device', kind: 'laptop', position: { x: 200, y: 10 } });
    const laptopId = state.selectedId as string;

    state = labReducer(state, {
      type: 'connect-cable',
      a: { deviceId: laptopId, portId: 'eth' },
      b: { deviceId: routerId, portId: 'lan1' },
    });
    expect(state.message).toBeNull();
    expect(state.lab.links).toHaveLength(1);

    const linkId = state.lab.links[0].id;
    state = labReducer(state, { type: 'disconnect-cable', linkId });
    expect(state.lab.links).toHaveLength(0);
  });

  it('reports why a phone cannot take a cable', () => {
    let state = labReducer(initialLabState(), { type: 'add-device', kind: 'router', position: { x: 10, y: 10 } });
    const routerId = state.selectedId as string;
    state = labReducer(state, { type: 'add-device', kind: 'phone', position: { x: 200, y: 10 } });
    const phoneId = state.selectedId as string;
    state = labReducer(state, {
      type: 'connect-cable',
      a: { deviceId: phoneId, portId: 'eth' },
      b: { deviceId: routerId, portId: 'lan1' },
    });
    expect(state.message).toBe('Un móvil no admite cable: solo se conecta por WiFi.');
    expect(state.lab.links).toHaveLength(0);
  });

  it('associates a phone with the WiFi and refuses when the router WiFi is off', () => {
    let state = labReducer(initialLabState(), { type: 'add-device', kind: 'router', position: { x: 10, y: 10 } });
    const routerId = state.selectedId as string;
    state = labReducer(state, { type: 'add-device', kind: 'phone', position: { x: 200, y: 10 } });
    const phoneId = state.selectedId as string;

    state = labReducer(state, { type: 'associate-wifi', id: phoneId, associated: true });
    expect(state.lab.devices.find((device) => device.id === phoneId)?.wifiAssociated).toBe(true);

    state = labReducer(state, { type: 'set-wifi', id: routerId, enabled: false });
    expect(state.lab.devices.find((device) => device.id === phoneId)?.wifiAssociated).toBe(false);
    state = labReducer(state, { type: 'associate-wifi', id: phoneId, associated: true });
    expect(state.message).toBe('El WiFi del router está desactivado.');
  });
});

describe('labReducer: router settings', () => {
  it('applies a new router address and reports an invalid one', () => {
    let state = labReducer(initialLabState(), { type: 'add-device', kind: 'router', position: { x: 10, y: 10 } });
    state = labReducer(state, { type: 'set-router-ip', ip: '192.168.9.1' });
    expect(state.lab.router?.lanIp).toBe('192.168.9.1');

    state = labReducer(state, { type: 'set-router-ip', ip: 'nope' });
    expect(state.lab.router?.lanIp).toBe('192.168.9.1');
    expect(state.message).toBe('Escribe una dirección IPv4 válida, por ejemplo 192.168.1.1.');
  });

  it('applies a new DHCP range and reports an invalid one', () => {
    let state = labReducer(initialLabState(), { type: 'add-device', kind: 'router', position: { x: 10, y: 10 } });
    state = labReducer(state, { type: 'set-dhcp-range', start: 20, end: 30 });
    expect(state.lab.router).toMatchObject({ dhcpStart: 20, dhcpEnd: 30 });

    state = labReducer(state, { type: 'set-dhcp-range', start: 30, end: 20 });
    expect(state.message).toBe('La dirección final debe ser mayor o igual que la inicial.');
  });
});

/** A router cabled to a laptop, the smallest lab with one link to select. */
function wiredState() {
  let state = labReducer(initialLabState(), { type: 'add-device', kind: 'router', position: { x: 10, y: 10 } });
  const routerId = state.selectedId as string;
  state = labReducer(state, { type: 'add-device', kind: 'laptop', position: { x: 200, y: 10 } });
  const laptopId = state.selectedId as string;
  state = labReducer(state, {
    type: 'connect-cable',
    a: { deviceId: laptopId, portId: 'eth' },
    b: { deviceId: routerId, portId: 'lan1' },
  });
  return { state, routerId, laptopId, linkId: state.lab.links[0].id };
}

describe('labReducer: cable selection (S33)', () => {
  it('starts with no cable selected and keeps the picked one', () => {
    const { state, linkId } = wiredState();
    expect(state.selectedLinkId).toBeNull();

    const selected = labReducer(state, { type: 'select-link', linkId });
    expect(selected.selectedLinkId).toBe(linkId);
    expect(selected.lab).toBe(state.lab);

    expect(labReducer(selected, { type: 'select-link', linkId: null }).selectedLinkId).toBeNull();
  });

  it('clears the selection when that cable is disconnected', () => {
    const { state, linkId } = wiredState();
    let next = labReducer(state, { type: 'select-link', linkId });
    next = labReducer(next, { type: 'disconnect-cable', linkId });
    expect(next.lab.links).toHaveLength(0);
    expect(next.selectedLinkId).toBeNull();
  });

  it('clears the selection when an endpoint device is deleted', () => {
    const { state, linkId, laptopId } = wiredState();
    let next = labReducer(state, { type: 'select-link', linkId });
    next = labReducer(next, { type: 'delete-device', id: laptopId });
    expect(next.lab.links).toHaveLength(0);
    expect(next.selectedLinkId).toBeNull();
  });

  it('keeps the selection when another cable is disconnected or another device is deleted', () => {
    const { state, linkId, routerId, laptopId } = wiredState();
    let next = labReducer(state, { type: 'select-link', linkId });
    next = labReducer(next, { type: 'disconnect-cable', linkId: 'l-unknown' });
    expect(next.selectedLinkId).toBe(linkId);

    next = labReducer(next, { type: 'add-device', kind: 'phone', position: { x: 300, y: 10 } });
    const phoneId = next.selectedId as string;
    next = labReducer(next, { type: 'delete-device', id: phoneId });
    expect(next.selectedLinkId).toBe(linkId);
    expect(next.lab.links[0].id).toBe(linkId);
    expect(next.lab.devices.some((device) => device.id === routerId)).toBe(true);
    expect(next.lab.devices.some((device) => device.id === laptopId)).toBe(true);
  });
});
