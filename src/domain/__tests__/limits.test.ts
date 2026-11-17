import { describe, expect, it } from 'vitest';
import { addDevice, createLab, renameDevice } from '../lab';
import { MAX_DEVICES, MAX_NAME_LENGTH, type Lab, type Result } from '../types';

const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) throw new Error(`expected ok, got error: ${result.error}`);
  return result.value;
};

const userDevices = (lab: Lab): number => lab.devices.filter((device) => device.kind !== 'internet').length;

describe('limits: twenty user devices (S47, D29)', () => {
  it('accepts the twentieth device and rejects the twenty-first', () => {
    let lab = unwrap(addDevice(createLab(), 'router', { x: 0, y: 0 }));
    for (let index = 1; index < MAX_DEVICES; index += 1) {
      lab = unwrap(addDevice(lab, 'laptop', { x: index, y: index }));
    }
    expect(userDevices(lab)).toBe(MAX_DEVICES);

    const over = addDevice(lab, 'phone', { x: 0, y: 0 });
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.code).toBe('too-many-devices');
      expect(over.params).toEqual({ max: MAX_DEVICES });
    }
  });

  it('does not count the Internet node against the limit', () => {
    const lab = unwrap(addDevice(createLab(), 'router', { x: 0, y: 0 }));
    expect(lab.devices).toHaveLength(2);
    expect(userDevices(lab)).toBe(1);
  });
});

describe('limits: the name length (S47)', () => {
  it('accepts forty characters and rejects forty-one', () => {
    const lab = unwrap(addDevice(createLab(), 'laptop', { x: 0, y: 0 }));
    const id = lab.devices[1].id;

    const exact = unwrap(renameDevice(lab, id, 'x'.repeat(MAX_NAME_LENGTH)));
    expect(exact.devices[1].name).toHaveLength(MAX_NAME_LENGTH);

    const over = renameDevice(lab, id, 'x'.repeat(MAX_NAME_LENGTH + 1));
    expect(over.ok).toBe(false);
    if (!over.ok) {
      expect(over.code).toBe('name-too-long');
      expect(over.params).toEqual({ max: MAX_NAME_LENGTH });
    }
  });

  it('trims before measuring, so trailing spaces do not count', () => {
    const lab = unwrap(addDevice(createLab(), 'laptop', { x: 0, y: 0 }));
    const id = lab.devices[1].id;
    const name = 'x'.repeat(MAX_NAME_LENGTH);
    expect(unwrap(renameDevice(lab, id, `  ${name}  `)).devices[1].name).toBe(name);
  });
});
