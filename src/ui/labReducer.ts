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
import type { DeviceKind, Point, PortRef } from '../domain/types';

export interface LabState {
  lab: Lab;
  selectedId: string | null;
  /** Cable picked on the canvas, shown with its delete badge (S33). */
  selectedLinkId: string | null;
  hoveredId: string | null;
  /** Last user-facing failure, in the exact wording of the specification. */
  message: string | null;
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
  | { type: 'reset' };

export function initialLabState(): LabState {
  return { lab: createLab(), selectedId: null, selectedLinkId: null, hoveredId: null, message: null };
}

export function labReducer(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'add-device': {
      const result = addDevice(state.lab, action.kind, action.position);
      if (!result.ok) return { ...state, message: result.error };
      const devices = result.value.devices;
      return { ...state, lab: result.value, selectedId: devices[devices.length - 1].id, message: null };
    }
    case 'move-device':
      return { ...state, lab: moveDevice(state.lab, action.id, action.position) };
    case 'rename-device':
      return apply(state, renameDevice(state.lab, action.id, action.name));
    case 'delete-device': {
      const result = deleteDevice(state.lab, action.id);
      if (!result.ok) return { ...state, message: result.error };
      return {
        ...state,
        lab: result.value,
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        selectedLinkId: linkStillExists(result.value, state.selectedLinkId),
        message: null,
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
      return { ...state, message: null };
    case 'reset':
      return initialLabState();
    default:
      return state;
  }
}

function apply(state: LabState, result: Result<Lab>): LabState {
  return result.ok ? { ...state, lab: result.value, message: null } : { ...state, message: result.error };
}

/** Keeps a cable selection only while that cable is still part of the lab. */
function linkStillExists(lab: Lab, linkId: string | null): string | null {
  if (linkId === null) return null;
  return lab.links.some((link) => link.id === linkId) ? linkId : null;
}
