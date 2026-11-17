import { createExampleLab } from '../domain/example';
import type { Device, Lab, PortRef } from '../domain/types';

/**
 * What the import dialog has to know about the lab on screen before replacing it (S55): is
 * there anything to lose, and is it the example the app preloaded?
 *
 * Pure rules over a `Lab`, no DOM and no React, so they are testable without a browser and
 * the dialog only has to ask.
 */
export function hasWork(lab: Lab): boolean {
  // A cable is work even if no device was added, and the Internet node is not the student's
  // doing: it is there in the empty start too.
  if (lab.links.length > 0) return true;
  return lab.devices.some((device) => device.kind !== 'internet');
}

/** Whether this lab shows the same network `createExampleLab()` builds. */
export function isExampleLab(lab: Lab): boolean {
  return canonical(lab) === canonicalExample();
}

/**
 * An import asks for confirmation only when it would throw away work that is not the example:
 * the empty lab is never worth stopping for, and the example is the state a teacher expects
 * to overwrite (S55).
 */
export function needsReplaceConfirmation(lab: Lab): boolean {
  return hasWork(lab) && !isExampleLab(lab);
}

/**
 * Only what the student can see decides this comparison. `id`, `mac` and `seq` are bookkeeping —
 * an imported case rebuilds them deterministically, so a case made from the example's own export
 * would otherwise stop being "the example" and a second import would ask a pointless question.
 *
 * Nothing here may depend on how the lab was assembled: `JSON.stringify` keeps the insertion
 * order of the keys, and the reducer, the storage and the codec do not agree on it, so every
 * object is written with its keys sorted. A cable compares by what it connects — the visible
 * identity of each device, not the position the array happens to give it — and neither the
 * order of the array nor the direction of a cable changes the answer.
 */
function canonical(lab: Lab): string {
  const deviceKey = new Map(
    lab.devices.map((device) => [device.id, JSON.stringify(sorted(visible(device)))]),
  );
  const deviceOf = (id: string): string => deviceKey.get(id) ?? id;
  const port = (ref: PortRef): string => JSON.stringify([deviceOf(ref.deviceId), ref.portId]);

  const links = lab.links
    .map((link) => JSON.stringify([port(link.a), port(link.b)].sort()))
    .sort();

  return JSON.stringify(
    sorted({
      devices: [...deviceKey.values()].sort(),
      router:
        lab.router === null
          ? null
          : { ...lab.router, deviceId: deviceOf(lab.router.deviceId) },
      links,
    }),
  );
}

/** A device as the student sees it: `id` and `mac` are bookkeeping, not part of the scene. */
function visible(device: Device): Record<string, unknown> {
  const { id: _id, mac: _mac, ...rest } = device;
  return rest as Record<string, unknown>;
}

/** A copy with every object key in alphabetical order, recursively. Arrays keep their order. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value === null || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, sorted(record[key])]),
  );
}

/** The example is deterministic, so its canonical form is built once and reused. */
let exampleKey: string | null = null;

function canonicalExample(): string {
  if (exampleKey === null) exampleKey = canonical(createExampleLab());
  return exampleKey;
}
