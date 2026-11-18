import {
  addDevice,
  connectCable,
  connectWifi,
  createLab,
  deleteDevice,
  disconnectCable,
  moveDevice,
  renameDevice,
  setAddressing,
  setDhcpRange,
  setEthernetEnabled,
  setRouterLanIp,
  setWifiEnabled,
  type AddressingPatch,
  type Lab,
  type Result,
} from '../domain/lab';
import type { DeviceKind, DomainMessageCode, MessageParams, Point, PortRef } from '../domain/types';

/** Steps of undo kept in `past`: labs are small, but a classroom machine is not infinite (S81). */
const HISTORY_LIMIT = 100;

export interface LabState {
  lab: Lab;
  /** The labs this document has been, newest at the end: what `undo` walks back (S81). */
  past: Lab[];
  /** The labs an undone edit left behind, oldest at the front: what `redo` walks forward. */
  future: Lab[];
  selectedId: string | null;
  /** Cable picked on the canvas, shown with its delete badge (S33). */
  selectedLinkId: string | null;
  hoveredId: string | null;
  /** Last user-facing failure, in the exact wording of the specification. */
  message: string | null;
  /** The same failure as a code, so the banner can be rendered in either language. */
  messageCode: DomainMessageCode | null;
  messageParams?: MessageParams;
}

export type LabAction =
  | { type: 'add-device'; kind: DeviceKind; position: Point }
  | { type: 'move-device'; id: string; position: Point }
  | { type: 'rename-device'; id: string; name: string }
  | { type: 'delete-device'; id: string }
  | { type: 'connect-cable'; a: PortRef; b: PortRef }
  | { type: 'disconnect-cable'; linkId: string }
  | { type: 'set-ethernet'; id: string; enabled: boolean }
  | { type: 'set-wifi'; id: string; enabled: boolean }
  | { type: 'associate-wifi'; id: string; associated: boolean }
  | { type: 'set-addressing'; id: string; patch: AddressingPatch }
  | { type: 'set-router-ip'; ip: string }
  | { type: 'set-dhcp-range'; start: number; end: number }
  | { type: 'select'; id: string | null }
  | { type: 'select-link'; linkId: string | null }
  | { type: 'hover'; id: string | null }
  | { type: 'dismiss-message' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'load'; lab: Lab }
  | { type: 'reset' };

export function initialLabState(): LabState {
  return {
    lab: createLab(),
    past: [],
    future: [],
    selectedId: null,
    selectedLinkId: null,
    hoveredId: null,
    message: null,
    messageCode: null,
  };
}

/**
 * A state that only carries a lab, with no history: used by the example lab, the stored lab
 * and the lab of a level or a case (S24, S31). Opening a document is not an edit (S81).
 */
export function labStateWith(lab: Lab): LabState {
  return {
    lab,
    past: [],
    future: [],
    selectedId: null,
    selectedLinkId: null,
    hoveredId: null,
    message: null,
    messageCode: null,
  };
}

export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'add-device': {
      const result = addDevice(state.lab, action.kind, action.position);
      if (!result.ok) return failed(state, result);
      const devices = result.value.devices;
      return {
        ...edited(state, result.value),
        selectedId: devices[devices.length - 1].id,
      };
    }
    case 'move-device': {
      const next = moveDevice(state.lab, action.id, action.position);
      // A move of a device that is gone changes nothing: there is no step to undo (S81).
      if (next === state.lab) return state;
      return withHistory(state, next);
    }
    case 'rename-device':
      return apply(state, renameDevice(state.lab, action.id, action.name));
    case 'delete-device': {
      const result = deleteDevice(state.lab, action.id);
      if (!result.ok) return failed(state, result);
      return {
        ...edited(state, result.value),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        selectedLinkId: linkStillExists(result.value, state.selectedLinkId),
      };
    }
    case 'connect-cable':
      return apply(state, connectCable(state.lab, action.a, action.b));
    case 'disconnect-cable': {
      const next = apply(state, disconnectCable(state.lab, action.linkId));
      // The cable may be gone: the selection goes with it (S33).
      return { ...next, selectedLinkId: linkStillExists(next.lab, next.selectedLinkId) };
    }
    case 'set-ethernet':
      return apply(state, setEthernetEnabled(state.lab, action.id, action.enabled));
    case 'set-wifi':
      return apply(state, setWifiEnabled(state.lab, action.id, action.enabled));
    case 'associate-wifi':
      return apply(state, connectWifi(state.lab, action.id, action.associated));
    case 'set-addressing':
      return apply(state, setAddressing(state.lab, action.id, action.patch));
    case 'set-router-ip':
      return apply(state, setRouterLanIp(state.lab, action.ip));
    case 'set-dhcp-range':
      return apply(state, setDhcpRange(state.lab, action.start, action.end));
    case 'select':
      return { ...state, selectedId: action.id };
    case 'select-link':
      return { ...state, selectedLinkId: action.linkId };
    case 'hover':
      return { ...state, hoveredId: action.id };
    case 'dismiss-message':
      return { ...state, message: null, messageCode: null };
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      // An empty stack is a no-op, with no message: the button is already disabled and a
      // shortcut that arrives too early is simply ignored (S81).
      if (previous === undefined) return state;
      return {
        ...restore(state, previous),
        past: state.past.slice(0, -1),
        future: [state.lab, ...state.future],
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (next === undefined) return state;
      return {
        ...restore(state, next),
        past: [...state.past, state.lab].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
      };
    }
    case 'load':
      return labStateWith(action.lab);
    case 'reset':
      return initialLabState();
    default:
      return state;
  }
}

function apply(state: LabState, result: Result<Lab>): LabState {
  return result.ok ? edited(state, result.value) : failed(state, result);
}

/** A lab that changed under its own rules, so the banner of the previous failure goes away. */
function edited(state: LabState, lab: Lab): LabState {
  return { ...withHistory(state, lab), message: null, messageCode: null };
}

/**
 * The one place that records a step (S81): the lab on screen becomes the newest entry of
 * `past`, capped at `HISTORY_LIMIT`, and whatever had been undone is no longer ahead.
 * Called only by an edit that succeeded; a failed one changed nothing, so it has no step.
 */
function withHistory(state: LabState, lab: Lab): LabState {
  return { ...state, lab, past: [...state.past, state.lab].slice(-HISTORY_LIMIT), future: [] };
}

/**
 * A lab brought back by `undo` or `redo`. The selections survive only while the device and the
 * cable they name are still part of it (S81), and the message banner is left exactly as the
 * incoming state had it: undoing an edit is not a failure and does not clear one either.
 */
function restore(state: LabState, lab: Lab): LabState {
  return {
    ...state,
    lab,
    selectedId:
      state.selectedId !== null && lab.devices.some((device) => device.id === state.selectedId)
        ? state.selectedId
        : null,
    selectedLinkId: linkStillExists(lab, state.selectedLinkId),
  };
}

/** A failure travels twice: as the domain's Spanish text and as a code for the catalogue. */
function failed(state: LabState, result: Extract<Result<Lab>, { ok: false }>): LabState {
  return { ...state, message: result.error, messageCode: result.code, messageParams: result.params };
}

/** Keeps a cable selection only while that cable is still part of the lab. */
function linkStillExists(lab: Lab, linkId: string | null): string | null {
  if (linkId === null) return null;
  return lab.links.some((link) => link.id === linkId) ? linkId : null;
}
