import { describe, expect, it } from 'vitest';
import { computeStatus, type Diagnosis } from '../diagnostics';
import {
  INTERNET_ID,
  addDevice,
  connectCable,
  deleteDevice,
  renameDevice,
  setDhcpRange,
  setRouterLanIp,
  type Lab,
  type Result,
} from '../lab';
import type { DomainMessageCode, MessageParams } from '../types';
import { scene } from './helpers';

interface FailureCase {
  name: string;
  /** Builds a fresh lab and triggers the failure. */
  run: () => Result<Lab>;
  code: DomainMessageCode;
  /** Raw values the message carries, or undefined when the text interpolates nothing. */
  params: MessageParams | undefined;
  /** The Spanish text stays byte-identical: this work is additive only. */
  error: string;
}

const failures: FailureCase[] = [
  {
    name: 'renaming to a name another device already has',
    run: () => {
      const s = scene();
      const laptop = s.add('laptop');
      return renameDevice(s.lab, laptop, ' internet ');
    },
    code: 'name-taken',
    params: { name: 'internet' },
    error: 'Ya hay un dispositivo llamado internet.',
  },
  {
    name: 'renaming to a blank name',
    run: () => {
      const s = scene();
      return renameDevice(s.lab, s.add('laptop'), '   ');
    },
    code: 'name-empty',
    params: undefined,
    error: 'El nombre no puede estar vacío.',
  },
  {
    name: 'adding a second router',
    run: () => {
      const s = scene();
      s.router();
      return addDevice(s.lab, 'router', { x: 0, y: 0 });
    },
    code: 'router-already-exists',
    params: undefined,
    error: 'Ya hay un router en el laboratorio.',
  },
  {
    name: 'plugging a cable into an occupied port',
    run: () => {
      const s = scene();
      const router = s.router();
      const laptop = s.add('laptop');
      s.cable(router, 'lan1', laptop, 'eth');
      return connectCable(s.lab, { deviceId: laptop, portId: 'eth' }, { deviceId: INTERNET_ID, portId: 'wan' });
    },
    code: 'port-occupied',
    params: { port: 'eth' },
    error: 'Ese puerto ya está ocupado.',
  },
  {
    name: 'plugging a cable into a phone',
    run: () => {
      const s = scene();
      const router = s.router();
      const phone = s.add('phone');
      return connectCable(s.lab, { deviceId: phone, portId: 'eth' }, { deviceId: router, portId: 'lan1' });
    },
    code: 'phone-no-cable',
    params: undefined,
    error: 'Un móvil no admite cable: solo se conecta por WiFi.',
  },
  {
    name: 'plugging the router WAN into a switch',
    run: () => {
      const s = scene();
      const router = s.router();
      const netSwitch = s.add('switch');
      return connectCable(s.lab, { deviceId: router, portId: 'wan' }, { deviceId: netSwitch, portId: 'p1' });
    },
    code: 'wan-only-internet',
    params: undefined,
    error: 'El puerto WAN solo se conecta a Internet.',
  },
  {
    name: 'plugging the Internet node into a switch',
    run: () => {
      const s = scene();
      s.router();
      const netSwitch = s.add('switch');
      return connectCable(s.lab, { deviceId: INTERNET_ID, portId: 'wan' }, { deviceId: netSwitch, portId: 'p1' });
    },
    code: 'internet-only-wan',
    params: undefined,
    error: 'El nodo Internet solo se conecta al puerto WAN del router.',
  },
  {
    name: 'a DHCP range outside the subnet',
    run: () => {
      const s = scene();
      s.router();
      return setDhcpRange(s.lab, 300, 400);
    },
    code: 'dhcp-range-outside-subnet',
    params: { network: '192.168.1.0', start: 300, end: 400 },
    error: 'El rango debe estar dentro de la subred 192.168.1.0.',
  },
  {
    name: 'a DHCP range that contains the router address',
    run: () => {
      const s = scene();
      s.router();
      s.lanIp('192.168.1.100');
      return setDhcpRange(s.lab, 2, 150);
    },
    code: 'dhcp-range-includes-router',
    params: { routerIp: '192.168.1.100', start: 2, end: 150 },
    error: 'El rango no puede incluir la dirección del router (192.168.1.100).',
  },
  {
    name: 'a DHCP range whose end is below its start',
    run: () => {
      const s = scene();
      s.router();
      return setDhcpRange(s.lab, 50, 10);
    },
    code: 'dhcp-range-inverted',
    params: { start: 50, end: 10 },
    error: 'La dirección final debe ser mayor o igual que la inicial.',
  },
  {
    name: 'an invalid router address',
    run: () => {
      const s = scene();
      s.router();
      return setRouterLanIp(s.lab, '192.168.1');
    },
    code: 'invalid-ipv4',
    params: { ip: '192.168.1' },
    error: 'Escribe una dirección IPv4 válida, por ejemplo 192.168.1.1.',
  },
  {
    name: 'a router address ending in .0',
    run: () => {
      const s = scene();
      s.router();
      return setRouterLanIp(s.lab, '192.168.1.0');
    },
    code: 'router-ip-broadcast',
    params: { ip: '192.168.1.0' },
    error: 'La dirección del router no puede terminar en .0 ni en .255.',
  },
  {
    name: 'a router address ending in .255',
    run: () => {
      const s = scene();
      s.router();
      return setRouterLanIp(s.lab, '192.168.1.255');
    },
    code: 'router-ip-broadcast',
    params: { ip: '192.168.1.255' },
    error: 'La dirección del router no puede terminar en .0 ni en .255.',
  },
  {
    name: 'deleting the Internet node',
    run: () => {
      const s = scene();
      return deleteDevice(s.lab, INTERNET_ID);
    },
    code: 'internet-not-deletable',
    params: undefined,
    error: 'El nodo Internet no se puede eliminar.',
  },
];

describe('domain messages: validation failures carry a code and raw params', () => {
  for (const failure of failures) {
    it(`${failure.name} -> ${failure.code}`, () => {
      const result = failure.run();
      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error).toBe(failure.error);
      expect(result.code).toBe(failure.code);
      expect(result.params).toEqual(failure.params);
    });
  }
});

/**
 * Compile-time exhaustive catalogue: a code added to the union without a line here
 * fails to compile, and a line whose code does not exist fails too.
 */
const codes: Record<DomainMessageCode, true> = {
  'address-not-assignable': true,
  'cable-missing': true,
  'dead-end-cable': true,
  'device-missing': true,
  'dhcp-range-includes-router': true,
  'dhcp-range-inverted': true,
  'dhcp-range-outside-subnet': true,
  'ethernet-disabled': true,
  'gateway-wrong': true,
  'internet-not-addable': true,
  'internet-not-deletable': true,
  'internet-only-wan': true,
  'invalid-client-ipv4': true,
  'invalid-gateway': true,
  'invalid-ipv4': true,
  'ip-duplicate': true,
  'ip-outside-subnet': true,
  'name-empty': true,
  'name-taken': true,
  'no-ethernet': true,
  'no-lease': true,
  'no-router-yet': true,
  'no-wifi': true,
  'no-wifi-network': true,
  'not-connected': true,
  'phone-no-cable': true,
  'port-missing': true,
  'port-occupied': true,
  'router-already-exists': true,
  'router-ip-broadcast': true,
  'router-no-wan': true,
  'router-no-wan-address': true,
  'router-wifi-off': true,
  'self-connection': true,
  'wan-not-router': true,
  'wan-only-internet': true,
  'wifi-disabled': true,
};

describe('domain messages: the code catalogue', () => {
  it('lists every code once and keeps them kebab-case', () => {
    const listed = Object.keys(codes);
    // A key written twice in the literal collapses silently, so the count is explicit.
    expect(listed).toHaveLength(37);
    expect(listed.every((code) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(code))).toBe(true);
  });
});

interface DiagnosticCase {
  name: string;
  run: () => Diagnosis;
  code: string;
  params: MessageParams;
  text: string;
}

const diagnosticCases: DiagnosticCase[] = [
  {
    name: 'a cable towards a device that gives no way out',
    run: () => {
      const s = scene();
      s.router();
      const netSwitch = s.add('switch');
      const laptop = s.add('laptop');
      s.cable(laptop, 'eth', netSwitch, 'p1');
      return s.status(laptop).reason as Diagnosis;
    },
    code: 'dead-end-cable',
    params: { device: 'Switch-1' },
    text: 'Este cable va a Switch-1, que no da salida a Internet.',
  },
  {
    name: 'an address outside the router subnet',
    run: () => {
      const s = scene();
      const router = s.router();
      const laptop = s.add('laptop');
      s.cable(router, 'lan1', laptop, 'eth');
      s.manual(laptop, '10.0.0.5');
      return s.status(laptop).reason as Diagnosis;
    },
    code: 'ip-outside-subnet',
    params: { ip: '10.0.0.5', network: '192.168.1' },
    text: 'La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.',
  },
  {
    name: 'an address another device is already using',
    run: () => {
      const s = scene();
      const router = s.router();
      const laptop = s.add('laptop');
      const desktop = s.add('desktop');
      s.cable(router, 'lan1', laptop, 'eth');
      s.cable(router, 'lan2', desktop, 'eth');
      s.manual(laptop, '192.168.1.50');
      s.manual(desktop, '192.168.1.50');
      return s.status(laptop).reason as Diagnosis;
    },
    code: 'ip-duplicate',
    params: { ip: '192.168.1.50', device: 'PC-1' },
    text: 'La IP 192.168.1.50 ya está en uso por PC-1.',
  },
  {
    name: 'a gateway that is not the router address',
    run: () => {
      const s = scene();
      const router = s.router();
      const laptop = s.add('laptop');
      s.cable(router, 'lan1', laptop, 'eth');
      s.manual(laptop, '192.168.1.50', '192.168.1.99');
      return s.status(laptop).reason as Diagnosis;
    },
    code: 'gateway-wrong',
    params: { gateway: '192.168.1.99', routerIp: '192.168.1.1' },
    text: 'La puerta de enlace 192.168.1.99 no es la del router (192.168.1.1).',
  },
];

describe('domain diagnostics: interpolated rows expose raw params', () => {
  for (const diagnostic of diagnosticCases) {
    it(`${diagnostic.name} -> ${diagnostic.code}`, () => {
      const reason = diagnostic.run();
      expect(reason.code).toBe(diagnostic.code);
      expect(reason.params).toEqual(diagnostic.params);
      expect(reason.text).toBe(diagnostic.text);
    });
  }

  it('leaves params absent on rows that interpolate nothing', () => {
    const s = scene();
    s.router();
    const desktop = s.add('desktop');
    expect(computeStatus(s.lab)[desktop].reason).toEqual({
      code: 'not-connected',
      text: 'Este dispositivo no está conectado a ninguna red.',
    });
  });
});
