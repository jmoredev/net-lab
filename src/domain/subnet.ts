export type Octets = [number, number, number, number];

const OCTET = /^\d{1,3}$/;

export function parseIpv4(value: string): Octets | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!OCTET.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    octets.push(octet);
  }
  return octets as Octets;
}

export function isIpv4(value: string): boolean {
  return parseIpv4(value) !== null;
}

export function formatIpv4(octets: Octets): string {
  return octets.join('.');
}

/** Two addresses share their network when the first three octets match (/24). */
export function isInSubnet(ip: string, referenceIp: string): boolean {
  const a = parseIpv4(ip);
  const b = parseIpv4(referenceIp);
  if (!a || !b) return false;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export function networkOf(ip: string): string | null {
  const octets = parseIpv4(ip);
  if (!octets) return null;
  return formatIpv4([octets[0], octets[1], octets[2], 0]);
}

export function hostOctet(ip: string): number | null {
  const octets = parseIpv4(ip);
  return octets ? octets[3] : null;
}

export function withHostOctet(networkIp: string, host: number): string | null {
  const octets = parseIpv4(networkIp);
  if (!octets) return null;
  return formatIpv4([octets[0], octets[1], octets[2], host]);
}

/** A host address is usable when it is neither the network nor the broadcast address. */
export function isHostIp(ip: string): boolean {
  const host = hostOctet(ip);
  return host !== null && host !== 0 && host !== 255;
}
