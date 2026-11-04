import { describe, expect, it } from 'vitest';
import { addDevice, createLab, disconnectCable, setAddressing, setDhcpRange, setRouterLanIp } from '../lab';
import { computeStatus } from '../diagnostics';
import { scene } from './helpers';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!result.ok) throw new Error(`expected ok, got error: ${result.error}`);
  return result.value;
};

describe('addressing: DHCP leases', () => {
  it('hands out addresses from .2 upward in creation order', () => {
    const s = scene();
    const router = s.router();
    const laptop = s.add('laptop');
    const desktop = s.add('desktop');
    s.cable(laptop, 'eth', router, 'lan1');
    s.cable(desktop, 'eth', router, 'lan2');

    const status = computeStatus(s.lab);
    expect(status[laptop].ip).toBe('192.168.1.2');
    expect(status[desktop].ip).toBe('192.168.1.3');
  });

  it('skips addresses taken manually', () => {
    const s = scene();
    const router = s.router();
    const manualLaptop = s.add('laptop');
    const dhcpLaptop = s.add('laptop');
    s.cable(manualLaptop, 'eth', router, 'lan1');
    s.cable(dhcpLaptop, 'eth', router, 'lan2');
    s.manual(manualLaptop, '192.168.1.2');

    expect(computeStatus(s.lab)[dhcpLaptop].ip).toBe('192.168.1.3');
  });

  it('does not lease an address to a disconnected device', () => {
    const s = scene();
    const router = s.router();
    const wired = s.add('laptop');
    const loose = s.add('laptop');
    s.cable(wired, 'eth', router, 'lan1');

    expect(computeStatus(s.lab)[wired].ip).toBe('192.168.1.2');
    expect(computeStatus(s.lab)[loose].ip).toBeNull();
  });

  it('assigns a public WAN address when the router is plugged into the Internet node', () => {
    const s = scene();
    s.router();
    expect(s.lab.router!.wanIp).toBeNull();
    s.plugWan();
    expect(s.lab.router!.wanIp).toMatch(/^203\.0\.113\.\d+$/);
  });

  it('clears the WAN address when the WAN cable is removed', () => {
    const s = scene();
    s.router();
    s.plugWan();
    const linkId = s.lab.links[0].id;
    const cut = unwrap(disconnectCable(s.lab, linkId));
    expect(cut.router!.wanIp).toBeNull();
  });

  it('uses the router address as the gateway of a manual client', () => {
    const s = scene();
    const router = s.router();
    const laptop = s.add('laptop');
    s.cable(laptop, 'eth', router, 'lan1');
    s.manual(laptop, '192.168.1.50');
    expect(computeStatus(s.lab)[laptop].gateway).toBe('192.168.1.1');
  });
});

describe('addressing: router subnet changes', () => {
  it('re-leases DHCP clients into the new subnet and keeps manual addresses as they were', () => {
    const s = scene();
    const router = s.router();
    const dhcpLaptop = s.add('laptop');
    const manualLaptop = s.add('laptop');
    s.cable(dhcpLaptop, 'eth', router, 'lan1');
    s.cable(manualLaptop, 'eth', router, 'lan2');
    s.manual(manualLaptop, '192.168.1.50');
    s.lanIp('192.168.5.1');

    const status = computeStatus(s.lab);
    expect(status[dhcpLaptop].ip).toBe('192.168.5.2');
    expect(status[manualLaptop].ip).toBe('192.168.1.50');
    expect(status[manualLaptop].reason?.code).toBe('ip-outside-subnet');
  });

  it('rejects a malformed router address', () => {
    const lab = unwrap(addDevice(createLab(), 'router', { x: 0, y: 0 }));
    const result = setRouterLanIp(lab, '192.168.1.300');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Escribe una dirección IPv4 válida, por ejemplo 192.168.1.1.');
  });

  it('rejects a router address ending in .0 or .255', () => {
    const lab = unwrap(addDevice(createLab(), 'router', { x: 0, y: 0 }));
    for (const ip of ['192.168.1.0', '192.168.1.255']) {
      const result = setRouterLanIp(lab, ip);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('La dirección del router no puede terminar en .0 ni en .255.');
    }
  });
});

describe('addressing: DHCP range', () => {
  it('re-leases clients that fall outside a narrowed range', () => {
    const s = scene();
    const router = s.router();
    const first = s.add('laptop');
    s.cable(first, 'eth', router, 'lan1');
    s.range(20, 30);
    expect(computeStatus(s.lab)[first].ip).toBe('192.168.1.20');
  });

  it('rejects a range that contains the router address', () => {
    const s = scene();
    s.router();
    s.lanIp('192.168.1.50');
    const result = setDhcpRange(s.lab, 40, 60);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('El rango no puede incluir la dirección del router (192.168.1.50).');
  });

  it('rejects a range outside the host octets', () => {
    const lab = unwrap(addDevice(createLab(), 'router', { x: 0, y: 0 }));
    const zero = setDhcpRange(lab, 0, 50);
    expect(zero.ok).toBe(false);
    if (!zero.ok) expect(zero.error).toBe('El rango debe estar dentro de la subred 192.168.1.0.');

    const broadcast = setDhcpRange(lab, 50, 255);
    expect(broadcast.ok).toBe(false);
    if (!broadcast.ok) expect(broadcast.error).toBe('El rango debe estar dentro de la subred 192.168.1.0.');
  });

  it('rejects an inverted range', () => {
    const lab = unwrap(addDevice(createLab(), 'router', { x: 0, y: 0 }));
    const result = setDhcpRange(lab, 60, 40);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('La dirección final debe ser mayor o igual que la inicial.');
  });
});

describe('addressing: manual input validation', () => {
  it('rejects a malformed manual address', () => {
    const s = scene();
    s.router();
    const laptop = s.add('laptop');
    const result = setAddressing(s.lab, laptop, { mode: 'manual', manualIp: '192.168.1', manualGateway: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Escribe una dirección IPv4 válida, por ejemplo 192.168.1.20.');
  });

  it('accepts an address outside the subnet and lets diagnostics explain it', () => {
    const s = scene();
    const router = s.router();
    const laptop = s.add('laptop');
    s.cable(laptop, 'eth', router, 'lan1');
    s.manual(laptop, '10.0.0.7');
    expect(computeStatus(s.lab)[laptop].reason?.code).toBe('ip-outside-subnet');
  });

  it('does not let DHCP hand out an address used manually by a disconnected device', () => {
    const s = scene();
    const router = s.router();
    const reserved = s.add('laptop');
    const wired = s.add('laptop');
    s.manual(reserved, '192.168.1.2');
    s.cable(wired, 'eth', router, 'lan1');
    expect(computeStatus(s.lab)[wired].ip).toBe('192.168.1.3');
  });
});
