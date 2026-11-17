import { createExampleLab } from '../domain/example';
import type { Lab } from '../domain/types';

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
 * Cables compare by device index, which is what a cable is once the ids stop mattering.
 */
function canonical(lab: Lab): string {
  const index = new Map(lab.devices.map((device, position) => [device.id, position]));

  return JSON.stringify({
    devices: lab.devices.map(({ id: _id, mac: _mac, ...visible }) => visible),
    router:
      lab.router === null
        ? null
        : { ...lab.router, deviceId: index.get(lab.router.deviceId) ?? lab.router.deviceId },
    links: lab.links.map((link) => [
      index.get(link.a.deviceId) ?? link.a.deviceId,
      link.a.portId,
      index.get(link.b.deviceId) ?? link.b.deviceId,
      link.b.portId,
    ]),
  });
}

/** The example is deterministic, so its canonical form is built once and reused. */
let exampleKey: string | null = null;

function canonicalExample(): string {
  if (exampleKey === null) exampleKey = canonical(createExampleLab());
  return exampleKey;
}
