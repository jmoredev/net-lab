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
  | { type: 'hover'; id: string | null }
  | { type: 'dismiss-message' }
  | { type: 'reset' };

export function initialLabState(): LabState {
  return { lab: createLab(), selectedId: null, hoveredId: null, message: null };
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
        message: null,
      };
    }
    case 'connect-cable':
      return apply(state, connectCable(state.lab, action.a, action.b));
    case 'disconnect-cable':
      return apply(state, disconnectCable(state.lab, action.linkId));
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
