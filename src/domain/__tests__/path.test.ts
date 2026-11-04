import { describe, expect, it } from 'vitest';
import { INTERNET_ID } from '../lab';
import { findHops } from '../path';
import { scene } from './helpers';

describe('path: packet route', () => {
  it('routes a wired laptop to the Internet node through the router', () => {
    const s = scene();
    const router = s.router();
    const laptop = s.add('laptop');
    s.plugWan();
    s.cable(laptop, 'eth', router, 'lan1');

    const hops = findHops(s.lab, laptop, INTERNET_ID)!;
    expect(hops).not.toBeNull();
    expect(hops.map((h) => h.to)).toEqual([router, INTERNET_ID]);
    expect(hops.map((h) => h.via)).toEqual(['link', 'link']);
  });

  it('passes through a switch when one is in the way', () => {
    const s = scene();
    const router = s.router();
    const netSwitch = s.add('switch');
    const laptop = s.add('laptop');
    s.plugWan();
    s.cable(router, 'lan1', netSwitch, 'p1');
    s.cable(netSwitch, 'p2', laptop, 'eth');

    const hops = findHops(s.lab, laptop, INTERNET_ID)!;
    expect(hops.map((h) => h.to)).toEqual([netSwitch, router, INTERNET_ID]);
  });

  it('routes between two wireless clients through the router with WiFi hops', () => {
    const s = scene();
    const router = s.router();
    const phone = s.add('phone');
    const laptop = s.add('laptop');
    s.wifi(phone);
    s.wifi(laptop);

    const hops = findHops(s.lab, phone, laptop)!;
    expect(hops.map((h) => h.to)).toEqual([router, laptop]);
    expect(hops.map((h) => h.via)).toEqual(['wifi', 'wifi']);
  });

  it('returns null when there is no route', () => {
    const s = scene();
    s.router();
    const laptop = s.add('laptop');
    const desktop = s.add('desktop');
    expect(findHops(s.lab, laptop, desktop)).toBeNull();
  });

  it('returns no hops for a device talking to itself', () => {
    const s = scene();
    const laptop = s.add('laptop');
    expect(findHops(s.lab, laptop, laptop)).toEqual([]);
  });
});
