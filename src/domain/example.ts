import {
  INTERNET_ID,
  addDevice,
  connectCable,
  connectWifi,
  createLab,
  setWifiEnabled,
  type Lab,
  type Point,
  type Result,
} from './lab';
import type { DeviceKind } from './types';

/**
 * Positions of the example lab on the 1240x800 canvas with 88px boxes: the router on
 * top, the switch under it, the wired laptop at the lower left and the wireless pair
 * (laptop and phone) at the lower right. Every pair is at least 100px apart.
 */
const AT: Record<string, Point> = {
  router: { x: 560, y: 160 },
  switchDevice: { x: 560, y: 360 },
  wiredLaptop: { x: 200, y: 600 },
  wirelessLaptop: { x: 820, y: 560 },
  phone: { x: 980, y: 680 },
};

/**
 * The preconfigured lab of S24: a router with WiFi and `192.168.1.1` cabled to the
 * Internet node, a switch on `lan1`, a wired laptop on `p2` and a laptop and a phone
 * joined by WiFi. Every client takes its address from DHCP (`.2`, `.3`, `.4` in device
 * order) and all of them reach the Internet.
 */
export function createExampleLab(): Lab {
  const base = createLab();
  const router = create('router', base, AT.router);
  const netSwitch = create('switch', router.lab, AT.switchDevice);
  const wiredLaptop = create('laptop', netSwitch.lab, AT.wiredLaptop);
  const wirelessLaptop = create('laptop', wiredLaptop.lab, AT.wirelessLaptop);
  const phone = create('phone', wirelessLaptop.lab, AT.phone);

  let lab = phone.lab;
  lab = unwrap(setWifiEnabled(lab, router.id, true));
  lab = unwrap(connectCable(lab, { deviceId: router.id, portId: 'wan' }, { deviceId: INTERNET_ID, portId: 'wan' }));
  lab = unwrap(connectCable(lab, { deviceId: router.id, portId: 'lan1' }, { deviceId: netSwitch.id, portId: 'p1' }));
  lab = unwrap(connectCable(lab, { deviceId: wiredLaptop.id, portId: 'eth' }, { deviceId: netSwitch.id, portId: 'p2' }));
  lab = unwrap(connectWifi(lab, wirelessLaptop.id, true));
  lab = unwrap(connectWifi(lab, phone.id, true));
  return lab;
}

/** Adds one device and keeps its id, so the links below read by role and not by index. */
function create(kind: DeviceKind, lab: Lab, position: Point): { lab: Lab; id: string } {
  const next = unwrap(addDevice(lab, kind, position));
  const created = next.devices[next.devices.length - 1];
  return { lab: next, id: created.id };
}

/** A broken mutator chain is a programming error, never a state the student can reach. */
function unwrap(result: Result<Lab>): Lab {
  if (!result.ok) throw new Error(`no se pudo construir el laboratorio de ejemplo: ${result.error}`);
  return result.value;
}
