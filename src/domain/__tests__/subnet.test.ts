import { describe, expect, it } from 'vitest';
import { formatIpv4, isHostIp, isInSubnet, isIpv4, networkOf, parseIpv4 } from '../subnet';

describe('subnet', () => {
  it('parses a valid dotted-quad address', () => {
    expect(parseIpv4('192.168.1.10')).toEqual([192, 168, 1, 10]);
  });

  it('rejects malformed addresses', () => {
    for (const bad of ['', '192.168.1', '192.168.1.256', '192.168.1.a', '192.168.1.10.1', ' 192.168.1.1']) {
      expect(parseIpv4(bad)).toBeNull();
      expect(isIpv4(bad)).toBe(false);
    }
  });

  it('formats octets back to an address', () => {
    expect(formatIpv4([10, 0, 0, 7])).toBe('10.0.0.7');
  });

  it('treats two addresses with the same /24 network as the same subnet', () => {
    expect(isInSubnet('192.168.1.10', '192.168.1.1')).toBe(true);
    expect(isInSubnet('192.168.2.10', '192.168.1.1')).toBe(false);
    expect(networkOf('192.168.1.37')).toBe('192.168.1.0');
  });

  it('rejects network and broadcast addresses as host addresses', () => {
    expect(isHostIp('192.168.1.0')).toBe(false);
    expect(isHostIp('192.168.1.255')).toBe(false);
    expect(isHostIp('192.168.1.1')).toBe(true);
    expect(isHostIp('192.168.1.254')).toBe(true);
  });
});
