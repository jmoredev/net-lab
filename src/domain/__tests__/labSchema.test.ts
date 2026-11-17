import { describe, expect, it } from 'vitest';
import { addDevice, connectCable, createLab, setAddressing } from '../lab';
import { validateLab } from '../labSchema';
import type { Lab, Result } from '../types';

const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(`expected ok, got error: ${result.error}`);
  return result.value;
};

const clone = (lab: Lab): Lab => JSON.parse(JSON.stringify(lab)) as Lab;

/** Router cabled to a laptop with a manual address: every rule the validator checks. */
function sampleLab(): Lab {
  let lab = unwrap(addDevice(createLab(), 'router', { x: 120, y: 160 }));
  lab = unwrap(addDevice(lab, 'laptop', { x: 420, y: 520 }));
  const routerId = lab.devices[1].id;
  const laptopId = lab.devices[2].id;
  lab = unwrap(connectCable(lab, { deviceId: laptopId, portId: 'eth' }, { deviceId: routerId, portId: 'lan1' }));
  lab = unwrap(
    setAddressing(lab, laptopId, { mode: 'manual', manualIp: '192.168.1.50', manualGateway: '192.168.1.1' }),
  );
  return lab;
}

const issueOf = (lab: unknown) => {
  const result = validateLab(lab);
  if (result.ok) throw new Error('expected the validator to reject this lab');
  return result.issue;
};

describe('labSchema: accepts what the domain builds', () => {
  it('accepts a lab made by the lab operations, unchanged', () => {
    const lab = sampleLab();
    const result = validateLab(lab);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.lab).toEqual(lab);
  });

  it('accepts the empty lab, which has no router yet', () => {
    expect(validateLab(createLab()).ok).toBe(true);
  });
});

describe('labSchema: structure', () => {
  it('rejects a value that is not a lab', () => {
    expect(issueOf(null).path).toBe('lab');
    expect(issueOf({ devices: [], links: [], seq: 1 }).path).toBe('lab.devices');
    expect(issueOf({ devices: [], links: [], seq: 'nope' }).path).toBe('lab.seq');
  });

  it('rejects a device missing a field and points at it', () => {
    const lab = clone(sampleLab());
    const device = lab.devices[2] as unknown as Record<string, unknown>;
    delete device.addressing;
    expect(issueOf(lab).path).toBe('lab.devices[2].addressing');
  });

  it('rejects an unknown kind', () => {
    const lab = clone(sampleLab());
    (lab.devices[2] as unknown as Record<string, unknown>).kind = 'printer';
    expect(issueOf(lab).path).toBe('lab.devices[2].kind');
  });
});

describe('labSchema: the device set', () => {
  it('rejects a lab without its Internet node', () => {
    const lab = clone(sampleLab());
    lab.devices = lab.devices.filter((device) => device.kind !== 'internet');
    expect(issueOf(lab).path).toBe('lab.devices');
  });

  it('rejects an Internet node under another id', () => {
    const lab = clone(sampleLab());
    lab.devices[0].id = 'd99';
    expect(issueOf(lab).path).toBe('lab.devices[0].id');
  });

  it('rejects two devices with the same id', () => {
    const lab = clone(sampleLab());
    lab.devices[2].id = lab.devices[1].id;
    expect(issueOf(lab).path).toBe('lab.devices[2].id');
  });

  it('rejects two devices with the same name, in any case', () => {
    const lab = clone(sampleLab());
    lab.devices[2].name = lab.devices[1].name.toUpperCase();
    expect(issueOf(lab)).toMatchObject({ path: 'lab.devices[2].name', code: 'name-taken' });
  });

  it('rejects a second router', () => {
    const lab = clone(sampleLab());
    lab.devices.push({ ...lab.devices[1], id: 'd90', name: 'Router 2', mac: '02:00:5E:00:00:5A' });
    expect(issueOf(lab).path).toBe('lab.devices');
  });
});

describe('labSchema: cables', () => {
  it('rejects a cable to a device that is not there', () => {
    const lab = clone(sampleLab());
    lab.links[0].a.deviceId = 'd999';
    expect(issueOf(lab).code).toBe('device-missing');
  });

  it('rejects a cable to a port the device does not have', () => {
    const lab = clone(sampleLab());
    lab.links[0].a.portId = 'p7';
    expect(issueOf(lab)).toMatchObject({ path: 'lab.links[0].a.portId', code: 'port-missing' });
  });

  it('rejects the same port wired twice', () => {
    const lab = clone(sampleLab());
    lab.links.push({ ...lab.links[0], id: 'l90' });
    expect(issueOf(lab)).toMatchObject({ code: 'port-occupied', params: { port: 'eth' } });
  });

  it('rejects a device connected to itself', () => {
    const lab = clone(sampleLab());
    lab.links[0].b = { ...lab.links[0].a };
    expect(issueOf(lab).code).toBe('self-connection');
  });

  it('rejects a phone with a cable, and says to use WiFi', () => {
    let lab = sampleLab();
    lab = unwrap(addDevice(lab, 'phone', { x: 0, y: 0 }));
    const phone = lab.devices[lab.devices.length - 1];
    const router = lab.devices[1];
    lab = {
      ...lab,
      links: [
        ...lab.links,
        { id: 'l91', a: { deviceId: phone.id, portId: 'eth' }, b: { deviceId: router.id, portId: 'lan2' } },
      ],
    };
    expect(issueOf(lab).code).toBe('phone-no-cable');
  });

  it('rejects a WAN cable that does not pair the router with the Internet node', () => {
    const lab = clone(sampleLab());
    lab.links[0].b.portId = 'wan';
    expect(issueOf(lab).code).toBe('wan-only-internet');
  });

  it('rejects two cables with the same id', () => {
    let lab = sampleLab();
    lab = unwrap(addDevice(lab, 'switch', { x: 700, y: 160 }));
    const switchId = lab.devices[lab.devices.length - 1].id;
    const routerId = lab.devices[1].id;
    lab = {
      ...lab,
      links: [...lab.links, { id: lab.links[0].id, a: { deviceId: switchId, portId: 'p1' }, b: { deviceId: routerId, portId: 'lan2' } }],
    };
    expect(issueOf(lab)).toMatchObject({ path: 'lab.links[1].id' });
  });
});

describe('labSchema: addressing the old validator let through (D30)', () => {
  it('rejects a manual address that is not an IPv4', () => {
    const lab = clone(sampleLab());
    lab.devices[2].manualIp = '192.168.1';
    expect(issueOf(lab)).toMatchObject({ path: 'lab.devices[2].manualIp', code: 'invalid-client-ipv4' });
  });

  it('rejects a gateway that is not an IPv4', () => {
    const lab = clone(sampleLab());
    lab.devices[2].manualGateway = '999.1.1.1';
    expect(issueOf(lab)).toMatchObject({ path: 'lab.devices[2].manualGateway', code: 'invalid-gateway' });
  });

  it('rejects a broadcast router address', () => {
    const lab = clone(sampleLab());
    if (lab.router) lab.router.lanIp = '192.168.1.255';
    expect(issueOf(lab).code).toBe('router-ip-broadcast');
  });

  it('rejects an inverted DHCP range', () => {
    const lab = clone(sampleLab());
    if (lab.router) {
      lab.router.dhcpStart = 150;
      lab.router.dhcpEnd = 100;
    }
    expect(issueOf(lab).code).toBe('dhcp-range-inverted');
  });

  it('rejects a DHCP range that includes the router address', () => {
    const lab = clone(sampleLab());
    if (lab.router) {
      lab.router.lanIp = '192.168.1.50';
      lab.router.dhcpStart = 40;
      lab.router.dhcpEnd = 60;
    }
    expect(issueOf(lab).code).toBe('dhcp-range-includes-router');
  });

  it('rejects a DHCP range outside the host octets the domain allows', () => {
    const lab = clone(sampleLab());
    if (lab.router) lab.router.dhcpEnd = 255;
    expect(issueOf(lab).code).toBe('dhcp-range-outside-subnet');
  });

  it('rejects a WAN address that is not an IPv4', () => {
    const lab = clone(sampleLab());
    if (lab.router) lab.router.wanIp = '203.0.113';
    expect(issueOf(lab)).toMatchObject({ path: 'lab.router.wanIp', code: 'invalid-ipv4' });
  });
});

describe('labSchema: the router block', () => {
  it('rejects a router block with no router device', () => {
    const lab: Lab = {
      ...createLab(),
      router: { deviceId: 'd1', lanIp: '192.168.1.1', dhcpStart: 2, dhcpEnd: 100, ssid: 'X', wanIp: null },
    };
    expect(issueOf(lab).path).toBe('lab.router');
  });

  it('rejects a router block pointing at another device', () => {
    const lab = clone(sampleLab());
    if (lab.router) lab.router.deviceId = 'd999';
    expect(issueOf(lab).path).toBe('lab.router.deviceId');
  });

  it('rejects a router device with no block', () => {
    const lab = clone(sampleLab());
    lab.router = null;
    expect(issueOf(lab).path).toBe('lab.router');
  });
});
