/**
 * The level model and its goal evaluation (S65): a goal is a question the domain can
 * already answer, a missing device is an authoring error that fails the goal without
 * throwing, and evaluating never touches the lab it was given.
 */
import { describe, expect, it } from 'vitest';
import { createExampleLab } from '../example';
import {
  addDevice,
  connectCable,
  createLab,
  setAddressing,
  type Lab,
  type Result,
} from '../lab';
import { evaluateGoals, isLevelComplete, type Goal } from '../levels';

function unwrap(result: Result<Lab>): Lab {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** The id a device got when the fixture was built, so goals read by role and not by index. */
function idOf(lab: Lab, name: string): string {
  const device = lab.devices.find((candidate) => candidate.name === name);
  if (device === undefined) throw new Error(`the fixture has no device named ${name}`);
  return device.id;
}

function online(deviceId: string): Goal {
  return { kind: 'online', deviceId };
}

describe('evaluateGoals', () => {
  it('marks an online goal met when the device reaches the Internet', () => {
    const lab = createExampleLab();

    const states = evaluateGoals(lab, [online(idOf(lab, 'Laptop-1')), online(idOf(lab, 'Smartphone-1'))]);

    expect(states.map((state) => state.met)).toEqual([true, true]);
  });

  it('marks an online goal unmet while the device is not wired or joined yet', () => {
    const base = createLab();
    const router = unwrap(addDevice(base, 'router', { x: 560, y: 160 }));
    const laptop = unwrap(addDevice(router, 'laptop', { x: 200, y: 400 }));

    const states = evaluateGoals(laptop, [online(idOf(laptop, 'Laptop-1'))]);

    expect(states).toEqual([{ goal: online(idOf(laptop, 'Laptop-1')), met: false }]);
  });

  it('marks a manual-online goal met when a device navigates with its manual address', () => {
    const lab = createExampleLab();
    const wired = unwrap(
      setAddressing(lab, idOf(lab, 'Laptop-1'), {
        mode: 'manual',
        manualIp: '192.168.1.50',
        manualGateway: '192.168.1.1',
      }),
    );

    const states = evaluateGoals(wired, [{ kind: 'manual-online', deviceId: idOf(wired, 'Laptop-1') }]);

    expect(states[0].met).toBe(true);
  });

  it('does not accept DHCP for a manual-online goal, even when the device is online', () => {
    const lab = createExampleLab();

    const states = evaluateGoals(lab, [{ kind: 'manual-online', deviceId: idOf(lab, 'Laptop-2') }]);

    expect(states[0].met).toBe(false);
  });

  it('does not accept a manual address outside the network of the router', () => {
    const lab = createExampleLab();
    const outside = unwrap(
      setAddressing(lab, idOf(lab, 'Laptop-1'), {
        mode: 'manual',
        manualIp: '192.168.2.50',
        manualGateway: '192.168.1.1',
      }),
    );

    const states = evaluateGoals(outside, [{ kind: 'manual-online', deviceId: idOf(outside, 'Laptop-1') }]);

    expect(states[0].met).toBe(false);
  });

  it('fails a goal whose device does not exist, instead of throwing', () => {
    const lab = createExampleLab();

    const states = evaluateGoals(lab, [online('no-such-device')]);

    expect(states).toEqual([{ goal: online('no-such-device'), met: false }]);
  });

  it('answers one state per goal, in the order they were given', () => {
    const lab = createExampleLab();
    const goals: Goal[] = [online(idOf(lab, 'Laptop-1')), online(idOf(lab, 'Laptop-2')), online(idOf(lab, 'Smartphone-1'))];

    const states = evaluateGoals(lab, goals);

    expect(states.map((state) => state.goal)).toEqual(goals);
  });

  it('does not touch the lab it evaluates', () => {
    const lab = createExampleLab();
    const before = structuredClone(lab);

    evaluateGoals(lab, [online(idOf(lab, 'Laptop-1'))]);

    expect(lab).toEqual(before);
  });
});

describe('isLevelComplete', () => {
  it('is true when every goal is met and there is at least one', () => {
    const lab = createExampleLab();
    const goal = online(idOf(lab, 'Laptop-1'));
    const states = evaluateGoals(lab, [goal]);

    expect(isLevelComplete(states)).toBe(true);
  });

  it('is false while any goal is unmet', () => {
    const base = createLab();
    const router = unwrap(addDevice(base, 'router', { x: 560, y: 160 }));
    const laptop = unwrap(addDevice(router, 'laptop', { x: 200, y: 400 }));
    const goal = online(idOf(laptop, 'Laptop-1'));

    const states = evaluateGoals(laptop, [goal]);

    expect(isLevelComplete(states)).toBe(false);
  });

  it('is false for an empty goal list: no goals is not a level', () => {
    expect(isLevelComplete([])).toBe(false);
  });

  it('pins the guard that makes the WAN miswire impossible: the domain refuses it', () => {
    const base = createLab();
    const router = unwrap(addDevice(base, 'router', { x: 560, y: 160 }));
    const laptop = unwrap(addDevice(router, 'laptop', { x: 200, y: 400 }));

    const miswire = connectCable(
      laptop,
      { deviceId: idOf(laptop, 'Laptop-1'), portId: 'eth' },
      { deviceId: idOf(laptop, 'Router'), portId: 'wan' },
    );

    // The curriculum cannot ask for this mistake because the student cannot make it (L3).
    expect(miswire.ok).toBe(false);
  });
});
