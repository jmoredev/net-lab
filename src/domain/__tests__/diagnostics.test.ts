import { describe, expect, it } from 'vitest';
import { computeStatus } from '../diagnostics';
import { scene } from './helpers';

describe('diagnostics: reachable network', () => {
  it('reports a wired laptop behind a switch as online with an address', () => {
    const s = scene();
    const router = s.router();
    const netSwitch = s.add('switch');
    const laptop = s.add('laptop');
    s.plugWan();
    s.cable(router, 'lan1', netSwitch, 'p1');
    s.cable(netSwitch, 'p2', laptop, 'eth');

    const status = computeStatus(s.lab)[laptop];
    expect(status.hasInternet).toBe(true);
    expect(status.reason).toBeNull();
    expect(status.ip).toBe('192.168.1.2');
    expect(status.gateway).toBe('192.168.1.1');
  });

  it('reports a WiFi phone as online', () => {
    const s = scene();
    s.router();
    const phone = s.add('phone');
    s.plugWan();
    s.wifi(phone);

    const status = computeStatus(s.lab)[phone];
    expect(status.hasInternet).toBe(true);
    expect(status.ip).toBe('192.168.1.2');
  });
});

describe('diagnostics: reasons in priority order', () => {
  it('1. disabled Ethernet wins over every later cause', () => {
    const s = scene();
    const laptop = s.add('laptop');
    s.ethernet(laptop, false);
    expect(s.status(laptop).reason).toMatchObject({
      code: 'ethernet-disabled',
      text: 'La conexión Ethernet está desactivada en este dispositivo.',
    });
  });

  it('2. disabled WiFi on the device', () => {
    const s = scene();
    s.router();
    const laptop = s.add('laptop');
    s.deviceWifi(laptop, false);
    expect(s.status(laptop).reason).toMatchObject({
      code: 'wifi-disabled',
      text: 'La conexión WiFi está desactivada en este dispositivo.',
    });
  });

  it('3. nothing connected at all', () => {
    const s = scene();
    s.router();
    const desktop = s.add('desktop');
    expect(s.status(desktop).reason).toMatchObject({
      code: 'not-connected',
      text: 'Este dispositivo no está conectado a ninguna red.',
    });
  });

  it('4. router WiFi turned off', () => {
    const s = scene();
    s.router();
    const phone = s.add('phone');
    s.routerWifi(false);
    expect(s.status(phone).reason).toMatchObject({
      code: 'router-wifi-off',
      text: 'El WiFi del router está desactivado.',
    });
  });

  it('5. cable to a device that gives no access', () => {
    const s = scene();
    const laptop = s.add('laptop');
    const desktop = s.add('desktop');
    s.cable(laptop, 'eth', desktop, 'eth');
    expect(s.status(laptop).reason).toMatchObject({
      code: 'dead-end-cable',
      text: 'Este cable va a PC-1, que no da salida a Internet.',
    });
  });

  it('6. address outside the router subnet', () => {
    const s = scene();
    const router = s.router();
    const laptop = s.add('laptop');
    s.cable(laptop, 'eth', router, 'lan1');
    s.manual(laptop, '10.0.0.5');
    expect(s.status(laptop).reason).toMatchObject({
      code: 'ip-outside-subnet',
      text: 'La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.',
    });
  });

  it('7. duplicated address', () => {
    const s = scene();
    const router = s.router();
    const first = s.add('laptop');
    const second = s.add('laptop');
    s.cable(first, 'eth', router, 'lan1');
    s.cable(second, 'eth', router, 'lan2');
    s.manual(first, '192.168.1.50');
    s.manual(second, '192.168.1.50');
    expect(s.status(second).reason).toMatchObject({
      code: 'ip-duplicate',
      text: 'La IP 192.168.1.50 ya está en uso por Laptop-1.',
    });
  });

  it('8. wrong gateway on a manual client', () => {
    const s = scene();
    const router = s.router();
    const laptop = s.add('laptop');
    s.cable(laptop, 'eth', router, 'lan1');
    s.manual(laptop, '192.168.1.40', '192.168.1.99');
    expect(s.status(laptop).reason).toMatchObject({
      code: 'gateway-wrong',
      text: 'La puerta de enlace 192.168.1.99 no es la del router (192.168.1.1).',
    });
  });

  it('9. router without the WAN cable', () => {
    const s = scene();
    const router = s.router();
    const laptop = s.add('laptop');
    s.cable(laptop, 'eth', router, 'lan1');
    expect(s.status(laptop).reason).toMatchObject({
      code: 'router-no-wan',
      text: 'El router no está conectado a Internet: falta el cable WAN.',
    });
  });

  it('11. DHCP pool exhausted', () => {
    const s = scene();
    const router = s.router();
    const first = s.add('laptop');
    const second = s.add('laptop');
    s.plugWan();
    s.range(2, 2);
    s.cable(first, 'eth', router, 'lan1');
    s.cable(second, 'eth', router, 'lan2');
    expect(s.status(second).reason).toMatchObject({
      code: 'no-lease',
      text: 'El router no tiene direcciones libres en su rango DHCP.',
    });
  });

  it('keeps the first reason when several causes coexist', () => {
    const s = scene();
    const laptop = s.add('laptop');
    s.ethernet(laptop, false);
    s.deviceWifi(laptop, false);
    expect(s.status(laptop).reason?.code).toBe('ethernet-disabled');
  });

  it('reports the router itself as online only with a WAN address', () => {
    const s = scene();
    const router = s.router();
    expect(s.status(router).hasInternet).toBe(false);
    s.plugWan();
    expect(s.status(router).hasInternet).toBe(true);
  });
});
