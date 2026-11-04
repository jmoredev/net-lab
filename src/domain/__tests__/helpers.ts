import {
  INTERNET_ID,
  addDevice,
  connectCable,
  connectWifi,
  createLab,
  setAddressing,
  setEthernetEnabled,
  setRouterLanIp,
  setDhcpRange,
  setWifiEnabled,
  type DeviceKind,
  type Lab,
} from '../lab';
import { computeStatus, type DeviceStatus } from '../diagnostics';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false; error: string }): T => {
  if (!result.ok) throw new Error(`expected ok, got error: ${result.error}`);
  return result.value;
};

/** Mutable scenario builder so diagnostic cases read as the story they tell. */
export function scene() {
  const api = {
    lab: createLab() as Lab,

    add(kind: DeviceKind): string {
      api.lab = unwrap(addDevice(api.lab, kind, { x: 0, y: 0 }));
      const created = [...api.lab.devices].reverse().find((d) => d.kind === kind)!;
      return created.id;
    },

    router(): string {
      return api.add('router');
    },

    cable(a: string, aPort: string, b: string, bPort: string): void {
      api.lab = unwrap(connectCable(api.lab, { deviceId: a, portId: aPort }, { deviceId: b, portId: bPort }));
    },

    wifi(a: string, on = true): void {
      api.lab = unwrap(connectWifi(api.lab, a, on));
    },

    ethernet(a: string, on: boolean): void {
      api.lab = unwrap(setEthernetEnabled(api.lab, a, on));
    },

    deviceWifi(a: string, on: boolean): void {
      api.lab = unwrap(setWifiEnabled(api.lab, a, on));
    },

    routerWifi(on: boolean): void {
      api.lab = unwrap(setWifiEnabled(api.lab, api.lab.router!.deviceId, on));
    },

    lanIp(ip: string): void {
      api.lab = unwrap(setRouterLanIp(api.lab, ip));
    },

    range(start: number, end: number): void {
      api.lab = unwrap(setDhcpRange(api.lab, start, end));
    },

    plugWan(): void {
      api.cable(api.lab.router!.deviceId, 'wan', INTERNET_ID, 'wan');
    },

    manual(deviceId: string, ip: string, gateway?: string): void {
      api.lab = unwrap(setAddressing(api.lab, deviceId, { mode: 'manual', manualIp: ip, manualGateway: gateway ?? null }));
    },

    status(deviceId: string): DeviceStatus {
      return computeStatus(api.lab)[deviceId];
    },
  };
  return api;
}
