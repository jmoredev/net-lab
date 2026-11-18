/**
 * The eight levels as data (S72): every level starts with every goal unmet, is solvable
 * with the plain domain mutators — the same ones the student has —, cannot be dodged
 * with DHCP where it teaches manual addressing, and round-trips through the case
 * codec without being healed, so a level is a lab like any other (S70).
 */
import { describe, expect, it } from 'vitest';
import { decodeCase, encodeCase, type CaseData } from '../case';
import { computeStatus } from '../diagnostics';
import {
  INTERNET_ID,
  connectCable,
  connectWifi,
  setAddressing,
  setWifiEnabled,
  type Lab,
  type Result,
} from '../lab';
import { LEVELS, evaluateGoals, isLevelComplete, type Level } from '../levels';

function unwrap(result: Result<Lab>): Lab {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

function idOf(lab: Lab, name: string): string {
  const device = lab.devices.find((candidate) => candidate.name === name);
  if (device === undefined) throw new Error(`the fixture has no device named ${name}`);
  return device.id;
}

function level(id: string): Level {
  const found = LEVELS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no level with id ${id}`);
  return found;
}

describe('the eight levels (S72)', () => {
  it('has eight levels with unique ids and orders one to eight', () => {
    expect(LEVELS).toHaveLength(8);
    expect(new Set(LEVELS.map((entry) => entry.id)).size).toBe(8);
    expect(LEVELS.map((entry) => entry.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('starts with every goal unmet in every level', () => {
    for (const entry of LEVELS) {
      const states = evaluateGoals(entry.startLab, entry.goals);
      expect(states.some((state) => state.met), entry.id).toBe(false);
      expect(isLevelComplete(states), entry.id).toBe(false);
    }
  });

  it('is solvable: the domain mutators take every level to all goals met', () => {
    expect(isLevelComplete(evaluateGoals(solveLevel1(), level('enchufa-portatil').goals))).toBe(true);
    expect(isLevelComplete(evaluateGoals(solveLevel2(), level('falta-cable-internet').goals))).toBe(true);
    expect(isLevelComplete(evaluateGoals(solveLevel3(), level('wifi-sin-enganchar').goals))).toBe(true);
    expect(isLevelComplete(evaluateGoals(solveLevel4(), level('switch-del-aula').goals))).toBe(true);
    expect(isLevelComplete(evaluateGoals(solveLevel5(), level('ip-puesta-a-mano').goals))).toBe(true);
    expect(isLevelComplete(evaluateGoals(solveLevel6(), level('lio-de-cables').goals))).toBe(true);
    expect(isLevelComplete(evaluateGoals(solveLevel7(), level('monta-el-aula').goals))).toBe(true);
    expect(isLevelComplete(evaluateGoals(solveLevel8(), level('reparto-de-direcciones').goals))).toBe(true);
  });

  it('does not let DHCP dodge the levels that teach manual addressing', () => {
    const fifth = level('ip-puesta-a-mano');
    const dodged = unwrap(setAddressing(fifth.startLab, idOf(fifth.startLab, 'Laptop-1'), { mode: 'dhcp' }));
    const fifthStates = evaluateGoals(dodged, fifth.goals);
    expect(fifthStates[0].met).toBe(false);

    const eighth = level('reparto-de-direcciones');
    const dodgedFirst = unwrap(setAddressing(eighth.startLab, idOf(eighth.startLab, 'Laptop-1'), { mode: 'dhcp' }));
    const eighthStates = evaluateGoals(dodgedFirst, eighth.goals);
    expect(eighthStates[0].met).toBe(false);
  });

  it('round-trips every start lab through the case codec without healing it', () => {
    for (const entry of LEVELS) {
      const encoded = encodeCase({ meta: null, lab: entry.startLab } satisfies CaseData);
      expect(encoded.ok, entry.id).toBe(true);
      if (!encoded.ok) continue;
      const decoded = decodeCase(encoded.payload);
      expect(decoded.ok, entry.id).toBe(true);
      if (!decoded.ok) continue;

      expect(decoded.data.lab.devices, entry.id).toHaveLength(entry.startLab.devices.length);
      const statuses = computeStatus(decoded.data.lab);
      for (const device of decoded.data.lab.devices) {
        if (device.kind === 'laptop' || device.kind === 'desktop' || device.kind === 'phone') {
          expect(statuses[device.id]?.hasInternet, `${entry.id}: ${device.name}`).toBe(false);
        }
      }
    }
  });
});

/** Level 1: one cable from the laptop to a LAN port of the router. */
function solveLevel1(): Lab {
  const start = level('enchufa-portatil').startLab;
  return unwrap(
    connectCable(start, { deviceId: idOf(start, 'Laptop-1'), portId: 'eth' }, { deviceId: idOf(start, 'Router'), portId: 'lan1' }),
  );
}

/** Level 2: the WAN cable from the router to the Internet node. */
function solveLevel2(): Lab {
  const start = level('falta-cable-internet').startLab;
  return unwrap(
    connectCable(start, { deviceId: idOf(start, 'Router'), portId: 'wan' }, { deviceId: INTERNET_ID, portId: 'wan' }),
  );
}

/** Level 3: join the WiFi network. */
function solveLevel3(): Lab {
  const start = level('wifi-sin-enganchar').startLab;
  return unwrap(connectWifi(start, idOf(start, 'Laptop-1'), true));
}

/** Level 4: three PCs into the switch, and the switch into the router. */
function solveLevel4(): Lab {
  const start = level('switch-del-aula').startLab;
  const switchToRouter = unwrap(
    connectCable(start, { deviceId: idOf(start, 'Switch-1'), portId: 'p1' }, { deviceId: idOf(start, 'Router'), portId: 'lan1' }),
  );
  const first = unwrap(
    connectCable(switchToRouter, { deviceId: idOf(start, 'PC-1'), portId: 'eth' }, { deviceId: idOf(start, 'Switch-1'), portId: 'p2' }),
  );
  const second = unwrap(
    connectCable(first, { deviceId: idOf(start, 'PC-2'), portId: 'eth' }, { deviceId: idOf(start, 'Switch-1'), portId: 'p3' }),
  );
  return unwrap(
    connectCable(second, { deviceId: idOf(start, 'PC-3'), portId: 'eth' }, { deviceId: idOf(start, 'Switch-1'), portId: 'p4' }),
  );
}

/** Level 5: the same manual mode, in the network of the router this time. */
function solveLevel5(): Lab {
  const start = level('ip-puesta-a-mano').startLab;
  return unwrap(
    setAddressing(start, idOf(start, 'Laptop-1'), { mode: 'manual', manualIp: '192.168.1.50', manualGateway: '192.168.1.1' }),
  );
}

/** Level 6: one cable, one radio, one address. */
function solveLevel6(): Lab {
  const start = level('lio-de-cables').startLab;
  const pc = unwrap(
    connectCable(start, { deviceId: idOf(start, 'PC-1'), portId: 'eth' }, { deviceId: idOf(start, 'Router'), portId: 'lan2' }),
  );
  const radioOn = unwrap(setWifiEnabled(pc, idOf(start, 'Smartphone-1'), true));
  const joined = unwrap(connectWifi(radioOn, idOf(start, 'Smartphone-1'), true));
  return unwrap(
    setAddressing(joined, idOf(start, 'Laptop-1'), { mode: 'manual', manualIp: '192.168.1.50', manualGateway: '192.168.1.1' }),
  );
}

/** Level 7: the whole classroom, WAN line included, laptop over WiFi. */
function solveLevel7(): Lab {
  const start = level('monta-el-aula').startLab;
  const online = unwrap(
    connectCable(start, { deviceId: idOf(start, 'Router'), portId: 'wan' }, { deviceId: INTERNET_ID, portId: 'wan' }),
  );
  const switchToRouter = unwrap(
    connectCable(online, { deviceId: idOf(start, 'Switch-1'), portId: 'p1' }, { deviceId: idOf(start, 'Router'), portId: 'lan1' }),
  );
  const first = unwrap(
    connectCable(switchToRouter, { deviceId: idOf(start, 'PC-1'), portId: 'eth' }, { deviceId: idOf(start, 'Switch-1'), portId: 'p2' }),
  );
  const second = unwrap(
    connectCable(first, { deviceId: idOf(start, 'PC-2'), portId: 'eth' }, { deviceId: idOf(start, 'Switch-1'), portId: 'p3' }),
  );
  return unwrap(connectWifi(second, idOf(start, 'Laptop-1'), true));
}

/** Level 8: two manual addresses in the right network, and a phone that joins. */
function solveLevel8(): Lab {
  const start = level('reparto-de-direcciones').startLab;
  const first = unwrap(
    setAddressing(start, idOf(start, 'Laptop-1'), { mode: 'manual', manualIp: '192.168.1.50', manualGateway: '192.168.1.1' }),
  );
  const second = unwrap(
    setAddressing(first, idOf(start, 'Laptop-2'), { mode: 'manual', manualIp: '192.168.1.60', manualGateway: '192.168.1.1' }),
  );
  return unwrap(connectWifi(second, idOf(start, 'Smartphone-1'), true));
}
