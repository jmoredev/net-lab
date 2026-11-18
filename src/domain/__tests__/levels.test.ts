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
  dhcpRangeIsValidFor,
  renameDevice,
  setAddressing,
  setDhcpRange,
  setRouterLanIp,
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

/** The example lab with one device on a manual address the caller chooses. */
function manualAddress(name: string, ip: string, gateway: string): Lab {
  const lab = createExampleLab();
  return unwrap(
    setAddressing(lab, idOf(lab, name), { mode: 'manual', manualIp: ip, manualGateway: gateway }),
  );
}

/**
 * A router state the mutators would refuse: the point of these fixtures is that a level which
 * asks for an invalid range stays red even when the stored numbers happen to match (S73).
 */
function storedRange(lab: Lab, lanIp: string, start: number, end: number): Lab {
  if (!lab.router) throw new Error('the fixture has no router');
  return { ...lab, router: { ...lab.router, lanIp, dhcpStart: start, dhcpEnd: end } };
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

describe('address-is goals (S73)', () => {
  it('is met with exactly that manual address and that gateway', () => {
    const lab = manualAddress('Laptop-1', '192.168.1.50', '192.168.1.1');

    const states = evaluateGoals(lab, [
      { kind: 'address-is', deviceId: idOf(lab, 'Laptop-1'), ip: '192.168.1.50', gateway: '192.168.1.1' },
    ]);

    expect(states[0].met).toBe(true);
  });

  it('is not met while the address is another one, even inside the network', () => {
    const lab = manualAddress('Laptop-1', '192.168.1.50', '192.168.1.1');

    const states = evaluateGoals(lab, [
      { kind: 'address-is', deviceId: idOf(lab, 'Laptop-1'), ip: '192.168.1.77', gateway: '192.168.1.1' },
    ]);

    expect(states[0].met).toBe(false);
  });

  it('is not met while the gateway is another one', () => {
    const lab = manualAddress('Laptop-1', '192.168.1.50', '192.168.1.1');

    const states = evaluateGoals(lab, [
      { kind: 'address-is', deviceId: idOf(lab, 'Laptop-1'), ip: '192.168.1.50', gateway: '192.168.1.254' },
    ]);

    expect(states[0].met).toBe(false);
  });

  it('is not met by DHCP, even when the device is online with the address the goal asks for', () => {
    const lab = createExampleLab();

    const states = evaluateGoals(lab, [
      { kind: 'address-is', deviceId: idOf(lab, 'Laptop-2'), ip: '192.168.1.2', gateway: '192.168.1.1' },
    ]);

    expect(states[0].met).toBe(false);
  });

  it('fails an address-is goal whose device does not exist, instead of throwing', () => {
    const lab = createExampleLab();
    const goal: Goal = { kind: 'address-is', deviceId: 'no-such-device', ip: '192.168.1.10', gateway: '192.168.1.1' };

    expect(evaluateGoals(lab, [goal])).toEqual([{ goal, met: false }]);
  });
});

describe('router-network goals (S73)', () => {
  it('is met when the router has that network and that DHCP range', () => {
    const lab = createExampleLab();

    const states = evaluateGoals(lab, [
      { kind: 'router-network', lanIp: '192.168.1.1', dhcpStart: 2, dhcpEnd: 100 },
    ]);

    expect(states[0].met).toBe(true);
  });

  it('is met with the range a level asks for, once it is set with the domain mutators', () => {
    const lab = createExampleLab();
    const moved = unwrap(setRouterLanIp(lab, '192.168.5.1'));
    const ranged = unwrap(setDhcpRange(moved, 100, 200));

    const states = evaluateGoals(ranged, [
      { kind: 'router-network', lanIp: '192.168.5.1', dhcpStart: 100, dhcpEnd: 200 },
    ]);

    expect(states[0].met).toBe(true);
  });

  it('is not met while the network of the router is another one', () => {
    const lab = createExampleLab();

    const states = evaluateGoals(lab, [
      { kind: 'router-network', lanIp: '192.168.5.1', dhcpStart: 2, dhcpEnd: 100 },
    ]);

    expect(states[0].met).toBe(false);
  });

  it('is not met while the DHCP range is another one', () => {
    const lab = createExampleLab();

    const states = evaluateGoals(lab, [
      { kind: 'router-network', lanIp: '192.168.1.1', dhcpStart: 100, dhcpEnd: 200 },
    ]);

    expect(states[0].met).toBe(false);
  });

  it('is not met by a range that includes the router own address, even if the numbers match', () => {
    const lab = storedRange(createExampleLab(), '192.168.1.50', 50, 100);

    const states = evaluateGoals(lab, [
      { kind: 'router-network', lanIp: '192.168.1.50', dhcpStart: 50, dhcpEnd: 100 },
    ]);

    expect(states[0].met).toBe(false);
  });

  it('is not met by an inverted range, even if the numbers match', () => {
    const lab = storedRange(createExampleLab(), '192.168.1.1', 100, 50);

    const states = evaluateGoals(lab, [
      { kind: 'router-network', lanIp: '192.168.1.1', dhcpStart: 100, dhcpEnd: 50 },
    ]);

    expect(states[0].met).toBe(false);
  });

  it('is not met by the network or the broadcast address of the subnet', () => {
    // Neither a range from .0 nor one that ends in .255 is a range of usable hosts.
    const fromZero = storedRange(createExampleLab(), '192.168.1.1', 0, 100);
    const toBroadcast = storedRange(createExampleLab(), '192.168.1.1', 100, 255);

    expect(
      evaluateGoals(fromZero, [{ kind: 'router-network', lanIp: '192.168.1.1', dhcpStart: 0, dhcpEnd: 100 }])[0].met,
    ).toBe(false);
    expect(
      evaluateGoals(toBroadcast, [
        { kind: 'router-network', lanIp: '192.168.1.1', dhcpStart: 100, dhcpEnd: 255 },
      ])[0].met,
    ).toBe(false);
  });

  it('is not met when the lab has no router at all', () => {
    const states = evaluateGoals(createLab(), [
      { kind: 'router-network', lanIp: '192.168.1.1', dhcpStart: 2, dhcpEnd: 100 },
    ]);

    expect(states[0].met).toBe(false);
  });
});

describe('the DHCP invariants are shared with the editor (S73, R2-002)', () => {
  /** The ranges a student can reach or try to reach, valid and invalid, in one place. */
  const RANGES: [number, number][] = [
    [2, 100],
    [2, 254],
    [254, 254],
    [1, 100],
    [0, 255],
    [100, 50],
    [1, 1],
    [255, 255],
  ];

  it('accepts exactly the ranges the mutator accepts, rule for rule', () => {
    // One invariant, two readers: the editor that writes the range and the goal that asks for
    // it cannot disagree, because neither of them carries its own copy of the rules.
    for (const lanIp of ['192.168.1.1', '192.168.5.1', '192.168.1.50']) {
      const lab = storedRange(createExampleLab(), lanIp, 2, 100);
      for (const [start, end] of RANGES) {
        const what = `${lanIp} ${start}-${end}`;
        expect(dhcpRangeIsValidFor(lanIp, start, end), what).toBe(setDhcpRange(lab, start, end).ok);
      }
    }
  });

  it('agrees with the goal that asks for the same router network', () => {
    for (const lanIp of ['192.168.1.1', '192.168.1.50']) {
      const lab = storedRange(createExampleLab(), lanIp, 2, 100);
      for (const [start, end] of RANGES) {
        const what = `${lanIp} ${start}-${end}`;
        const goal: Goal = { kind: 'router-network', lanIp, dhcpStart: start, dhcpEnd: end };
        const accepted = evaluateGoals(storedRange(createExampleLab(), lanIp, start, end), [goal])[0].met;
        expect(accepted, what).toBe(setDhcpRange(lab, start, end).ok);
      }
    }
  });

  it('lets a lab reached through the real mutators pass the goal for those same values', () => {
    // The classroom of level 9: the router moved and its range set with the mutators the
    // student uses, then asked for by the goal with the same numbers (S73, S74).
    const moved = unwrap(setRouterLanIp(createExampleLab(), '192.168.5.1'));
    const ranged = unwrap(setDhcpRange(moved, 100, 200));

    const states = evaluateGoals(ranged, [
      { kind: 'router-network', lanIp: '192.168.5.1', dhcpStart: 100, dhcpEnd: 200 },
    ]);

    expect(states[0].met).toBe(true);
    expect(dhcpRangeIsValidFor('192.168.5.1', 100, 200)).toBe(true);
  });
});

describe('device-named goals (S73)', () => {
  it('is met when the device has exactly that name', () => {
    const lab = createExampleLab();
    const renamed = unwrap(renameDevice(lab, idOf(lab, 'Laptop-1'), 'Laptop-Docente'));

    const states = evaluateGoals(renamed, [
      { kind: 'device-named', deviceId: idOf(lab, 'Laptop-1'), name: 'Laptop-Docente' },
    ]);

    expect(states[0].met).toBe(true);
  });

  it('is not met with the default name of the device', () => {
    const lab = createExampleLab();

    const states = evaluateGoals(lab, [
      { kind: 'device-named', deviceId: idOf(lab, 'Laptop-1'), name: 'Laptop-Docente' },
    ]);

    expect(states[0].met).toBe(false);
  });

  it('is not met by another name that only differs in case', () => {
    const lab = createExampleLab();
    const renamed = unwrap(renameDevice(lab, idOf(lab, 'Laptop-1'), 'Laptop-Docente'));

    const states = evaluateGoals(renamed, [
      { kind: 'device-named', deviceId: idOf(lab, 'Laptop-1'), name: 'laptop-docente' },
    ]);

    expect(states[0].met).toBe(false);
  });

  it('fails a device-named goal whose device does not exist, instead of throwing', () => {
    const lab = createExampleLab();
    const goal: Goal = { kind: 'device-named', deviceId: 'no-such-device', name: 'Laptop-Docente' };

    expect(evaluateGoals(lab, [goal])).toEqual([{ goal, met: false }]);
  });
});

describe('evaluating the new goal kinds (S73)', () => {
  it('does not touch the lab it evaluates', () => {
    const lab = manualAddress('Laptop-1', '192.168.1.50', '192.168.1.1');
    const before = structuredClone(lab);

    evaluateGoals(lab, [
      { kind: 'address-is', deviceId: idOf(lab, 'Laptop-1'), ip: '192.168.1.50', gateway: '192.168.1.1' },
      { kind: 'router-network', lanIp: '192.168.1.1', dhcpStart: 2, dhcpEnd: 100 },
      { kind: 'device-named', deviceId: idOf(lab, 'Laptop-1'), name: 'Laptop-1' },
    ]);

    expect(lab).toEqual(before);
  });

  it('answers one state per goal, in the order they were given', () => {
    const lab = manualAddress('Laptop-1', '192.168.1.50', '192.168.1.1');
    const goals: Goal[] = [
      { kind: 'router-network', lanIp: '192.168.1.1', dhcpStart: 2, dhcpEnd: 100 },
      { kind: 'device-named', deviceId: idOf(lab, 'Laptop-1'), name: 'Laptop-1' },
      { kind: 'address-is', deviceId: idOf(lab, 'Laptop-1'), ip: '192.168.1.50', gateway: '192.168.1.1' },
    ];

    const states = evaluateGoals(lab, goals);

    expect(states.map((state) => state.goal)).toEqual(goals);
    expect(states.map((state) => state.met)).toEqual([true, true, true]);
  });
});
