import { describe, expect, it } from 'vitest';
import { decodeCase, encodeCase } from '../../domain/case';
import { createExampleLab } from '../../domain/example';
import { addDevice, deleteDevice, type Lab } from '../../domain/lab';
import type { Result } from '../../domain/types';
import { isExampleLab, needsReplaceConfirmation } from '../labComparison';

const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(`expected ok, got error: ${result.error}`);
  return result.value;
};

/**
 * The comparison decides whether the import dialog stops to ask, so it has to look at what the
 * student can see and nothing else. `id`, `mac` and `seq` are bookkeeping: adding a device and
 * deleting it again leaves the lab exactly as the example and only moves the counter, and an
 * imported case rebuilds those three values deterministically. If they counted, the pristine
 * example would look like somebody's work and every later import would ask for nothing (S55).
 */
describe('a lab that shows the example is the example, whatever its counters say (S55)', () => {
  it('ignores a counter moved by a device that was added and deleted', () => {
    const base = createExampleLab();
    let lab: Lab = unwrap(addDevice(base, 'phone', { x: 0, y: 0 }));
    lab = unwrap(deleteDevice(lab, lab.devices[lab.devices.length - 1].id));

    expect(lab.devices).toHaveLength(base.devices.length);
    expect(lab.seq).toBe(base.seq + 1);

    expect(isExampleLab(lab)).toBe(true);
    expect(needsReplaceConfirmation(lab)).toBe(false);
  });

  it('still recognises it after the round trip through a payload', () => {
    const lab = createExampleLab();
    const encoded = encodeCase({ meta: null, lab });
    if (!encoded.ok) throw new Error('expected the example lab to encode');

    const decoded = decodeCase(encoded.payload);
    if (!decoded.ok) throw new Error('expected the payload to decode');

    expect(decoded.data.lab.devices).toHaveLength(lab.devices.length);
    expect(isExampleLab(decoded.data.lab)).toBe(true);
    expect(needsReplaceConfirmation(decoded.data.lab)).toBe(false);
  });

  it('asks again as soon as one visible field changes', () => {
    const lab = createExampleLab();
    const moved = lab.devices.map((device, index) =>
      index === 1 ? { ...device, position: { x: 999, y: 999 } } : device,
    );

    expect(isExampleLab({ ...lab, devices: moved })).toBe(false);
    expect(needsReplaceConfirmation({ ...lab, devices: moved })).toBe(true);
  });
});
