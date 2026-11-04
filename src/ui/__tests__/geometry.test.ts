import { describe, expect, it } from 'vitest';
import { addDevice, createLab } from '../../domain/lab';
import { DEVICE_SIZE, deviceCenter, internetPosition, nextFreePosition, renderPosition } from '../geometry';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe('geometry', () => {
  it('centres a device box on its position', () => {
    const device = { position: { x: 100, y: 50 } } as never;
    expect(deviceCenter(device)).toEqual({ x: 100 + DEVICE_SIZE / 2, y: 50 + DEVICE_SIZE / 2 });
  });

  it('keeps the Internet node at its own fixed place', () => {
    const lab = createLab();
    const internet = lab.devices[0];
    expect(renderPosition(internet)).toEqual(internetPosition());
    expect(internetPosition().x).not.toBe(renderPosition({ ...internet, position: { x: 5, y: 5 } }).x - 5);
  });

  it('places a new device in the first free slot and never on top of another', () => {
    let lab = createLab();
    const first = nextFreePosition(lab);
    lab = unwrap(addDevice(lab, 'laptop', first));
    const second = nextFreePosition(lab);
    expect(second).not.toEqual(first);

    const tooClose = lab.devices.some(
      (device) =>
        Math.abs(renderPosition(device).x - second.x) < DEVICE_SIZE &&
        Math.abs(renderPosition(device).y - second.y) < DEVICE_SIZE,
    );
    expect(tooClose).toBe(false);
  });
});
