import { useEffect, useState, type Dispatch } from 'react';
import type { DeviceStatus } from '../../domain/diagnostics';
import { availablePorts, getDevice, portsOf, type Lab } from '../../domain/lab';
import { CAPABILITIES, type AddressingMode, type Device } from '../../domain/types';
import { ANALOGIES, type AnalogyKey } from '../analogies';
import { modeLabel, deviceLabel, portLabel } from '../format';
import type { LabAction, LabState } from '../labReducer';

export interface DevicePanelProps {
  state: LabState;
  statuses: Record<string, DeviceStatus>;
  dispatch: Dispatch<LabAction>;
  /** True while an animation runs: sending again is disabled (S23). */
  busy: boolean;
  /** Starts a trip; returns the reason shown when there is no route, or null on success. */
  onSend: (fromId: string, toId: string) => string | null;
}

export function DevicePanel({ state, statuses, dispatch, busy, onSend }: DevicePanelProps) {
  const { lab } = state;
  const device = state.selectedId ? getDevice(lab, state.selectedId) : undefined;
  if (!device) return null;

  const caps = CAPABILITIES[device.kind];
  const status = statuses[device.id];
  const isInternet = device.kind === 'internet';

  return (
    <aside className="panel" aria-label="Panel del dispositivo seleccionado">
      <header className="panel__header">
        <p className="panel__kind">{caps.label}</p>
        {isInternet ? (
          <h2 className="panel__name-static">{device.name}</h2>
        ) : (
          <NameField device={device} dispatch={dispatch} />
        )}
      </header>

      <section className="panel__section">
        <Row label="MAC" value={device.mac ?? '—'} />
        <Row label="IP" value={status?.ip ?? '—'} />
        <Row label="Puerta de enlace" value={status?.gateway ?? '—'} />
        <Row
          label="Internet"
          value={status?.hasInternet ? 'Con salida a Internet' : 'Sin salida a Internet'}
          tone={status?.hasInternet ? 'online' : 'offline'}
        />
        {status?.reason ? <p className="panel__reason">{status.reason.text}</p> : null}
      </section>

      {device.kind === 'router' ? (
        <RouterControls device={device} lab={lab} dispatch={dispatch} />
      ) : null}
      {caps.addressable ? (
        <ClientControls device={device} lab={lab} status={status} dispatch={dispatch} />
      ) : null}

      {caps.ports.length > 0 ? <PortList lab={lab} device={device} /> : null}
      <CableSection lab={lab} device={device} dispatch={dispatch} />
      <CableList lab={lab} device={device} dispatch={dispatch} />

      {/* A switch has no addressing and cannot be an endpoint of a packet (D1, S23). */}
      {device.kind === 'switch' ? null : (
        <SendSection
          device={device}
          lab={lab}
          statuses={statuses}
          busy={busy}
          onSend={onSend}
        />
      )}

      {isInternet ? null : (
        <section className="panel__section">
          <button
            type="button"
            className="button button--wide"
            onClick={() => dispatch({ type: 'delete-device', id: device.id })}
          >
            Eliminar dispositivo
          </button>
        </section>
      )}

      <section className="panel__section">
        <h3 className="panel__subtitle">Conceptos</h3>
        {conceptsFor(device).map((key) => (
          <Concept key={key} name={key} />
        ))}
      </section>
    </aside>
  );
}

function conceptsFor(device: Device): AnalogyKey[] {
  if (device.kind === 'router') return ['router', 'gateway', 'wan', 'lan', 'dhcp', 'subnet', 'nat'];
  if (device.kind === 'switch') return ['switch', 'lan', 'cable'];
  if (device.kind === 'internet') return ['internet', 'wan'];

  const caps = CAPABILITIES[device.kind];
  const keys: AnalogyKey[] = ['ip', 'mac', device.addressing === 'manual' ? 'manualIp' : 'dhcp', 'gateway'];
  if (caps.wifi) keys.push('wifi');
  if (caps.ports.length > 0) keys.push('cable');
  return keys;
}

function Concept({ name }: { name: AnalogyKey }) {
  const entry = ANALOGIES[name];
  return (
    <div className="concept">
      <p className="concept__term">{entry.term}</p>
      <p className="concept__explanation">{entry.explanation}</p>
      <p className="concept__analogy">{entry.analogy}</p>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'online' | 'offline' }) {
  return (
    <p className="panel__row">
      <span className="panel__key">{label}</span>
      <span className={`panel__value${tone ? ` panel__value--${tone}` : ''}`}>{value}</span>
    </p>
  );
}

function NameField({ device, dispatch }: { device: Device; dispatch: Dispatch<LabAction> }) {
  const [draft, setDraft] = useState(device.name);
  useEffect(() => setDraft(device.name), [device.id, device.name]);

  function commit() {
    setDraft(device.name);
    if (draft !== device.name) dispatch({ type: 'rename-device', id: device.id, name: draft });
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor="device-name">
        Nombre
      </label>
      <input
        id="device-name"
        className="field__input"
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        }}
      />
    </div>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onCommit: (value: string) => void;
  type?: 'text' | 'number';
  min?: number;
  max?: number;
}

/** Commits on blur or Enter so a half-typed address is never validated mid-word. */
function TextField({ id, label, value, onCommit, type = 'text', min, max }: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  function commit() {
    const next = draft.trim();
    setDraft(value);
    if (next !== value) onCommit(next);
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field__input"
        type={type}
        min={min}
        max={max}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        }}
      />
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="toggle">
      <input
        id={id}
        className="toggle__input"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label className="toggle__label" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}

function ClientControls({
  device,
  lab,
  status,
  dispatch,
}: {
  device: Device;
  lab: Lab;
  status: DeviceStatus | undefined;
  dispatch: Dispatch<LabAction>;
}) {
  const caps = CAPABILITIES[device.kind];
  const manual = device.addressing === 'manual';

  function changeMode(mode: AddressingMode) {
    if (mode === 'dhcp') {
      dispatch({ type: 'set-addressing', id: device.id, patch: { mode: 'dhcp' } });
      return;
    }
    dispatch({
      type: 'set-addressing',
      id: device.id,
      patch: {
        mode: 'manual',
        manualIp: status?.ip ?? null,
        manualGateway: status?.gateway ?? lab.router?.lanIp ?? null,
      },
    });
  }

  return (
    <section className="panel__section">
      <h3 className="panel__subtitle">Conexiones</h3>
      {caps.ports.length > 0 ? (
        <Toggle
          id="device-ethernet"
          label="Ethernet"
          checked={device.ethernetEnabled}
          onChange={(enabled) => dispatch({ type: 'set-ethernet', id: device.id, enabled })}
        />
      ) : null}
      {caps.wifi ? (
        <Toggle
          id="device-wifi"
          label="WiFi"
          checked={device.wifiEnabled}
          onChange={(enabled) => dispatch({ type: 'set-wifi', id: device.id, enabled })}
        />
      ) : null}
      <button
        type="button"
        className="button button--wide"
        disabled={!caps.wifi}
        onClick={() => dispatch({ type: 'associate-wifi', id: device.id, associated: !device.wifiAssociated })}
      >
        {device.wifiAssociated ? 'Desconectar de la WiFi' : 'Conectar a la WiFi'}
      </button>

      <h3 className="panel__subtitle">Direccionamiento</h3>
      <div className="field">
        <label className="field__label" htmlFor="device-addressing">
          Dirección IP
        </label>
        <select
          id="device-addressing"
          className="field__input"
          value={device.addressing}
          onChange={(event) => changeMode(event.target.value === 'manual' ? 'manual' : 'dhcp')}
        >
          <option value="dhcp">{modeLabel('dhcp')}</option>
          <option value="manual">{modeLabel('manual')}</option>
        </select>
      </div>
      {manual ? (
        <>
          <TextField
            id="device-manual-ip"
            label="IP manual"
            value={device.manualIp ?? ''}
            onCommit={(value) =>
              dispatch({
                type: 'set-addressing',
                id: device.id,
                patch: {
                  mode: 'manual',
                  manualIp: value === '' ? null : value,
                  manualGateway: device.manualGateway,
                },
              })
            }
          />
          <TextField
            id="device-manual-gateway"
            label="Puerta de enlace"
            value={device.manualGateway ?? ''}
            onCommit={(value) =>
              dispatch({
                type: 'set-addressing',
                id: device.id,
                patch: {
                  mode: 'manual',
                  manualIp: device.manualIp,
                  manualGateway: value === '' ? null : value,
                },
              })
            }
          />
        </>
      ) : null}
    </section>
  );
}

function RouterControls({
  device,
  lab,
  dispatch,
}: {
  device: Device;
  lab: Lab;
  dispatch: Dispatch<LabAction>;
}) {
  const router = lab.router;
  if (!router) return null;

  return (
    <section className="panel__section">
      <h3 className="panel__subtitle">Configuración</h3>
      <Toggle
        id="router-wifi"
        label="WiFi"
        checked={device.wifiEnabled}
        onChange={(enabled) => dispatch({ type: 'set-wifi', id: device.id, enabled })}
      />
      <TextField
        id="router-lan-ip"
        label="Dirección LAN del router"
        value={router.lanIp}
        onCommit={(ip) => dispatch({ type: 'set-router-ip', ip })}
      />
      <p className="panel__static">
        <span className="panel__key">Dirección WAN</span>
        <span className="panel__value">{router.wanIp ?? 'Sin conexión'}</span>
      </p>
      <TextField
        id="router-dhcp-start"
        label="Rango DHCP: desde"
        type="number"
        min={2}
        max={254}
        value={String(router.dhcpStart)}
        onCommit={(value) =>
          dispatch({ type: 'set-dhcp-range', start: Number(value), end: router.dhcpEnd })
        }
      />
      <TextField
        id="router-dhcp-end"
        label="Rango DHCP: hasta"
        type="number"
        min={2}
        max={254}
        value={String(router.dhcpEnd)}
        onCommit={(value) =>
          dispatch({ type: 'set-dhcp-range', start: router.dhcpStart, end: Number(value) })
        }
      />
    </section>
  );
}

function PortList({ lab, device }: { lab: Lab; device: Device }) {
  return (
    <section className="panel__section">
      <h3 className="panel__subtitle">Puertos</h3>
      <ul className="ports">
        {portsOf(device).map((portId) => {
          const peer = occupantOf(lab, device.id, portId);
          return (
            <li key={portId} className="ports__row">
              <span className="ports__name">{portLabel(device, portId)}</span>
              <span className="ports__state">{peer ? `Ocupado por ${peer.name}` : 'Libre'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface CableTarget {
  peer: Device;
  portId: string;
  localPort: string;
}

/** Cable choices of S12/S13: only free ports of compatible devices, never a phone. */
function cableTargets(lab: Lab, device: Device): CableTarget[] {
  const free = availablePorts(lab, device.id);
  if (free.length === 0) return [];
  const targets: CableTarget[] = [];

  for (const peer of lab.devices) {
    if (peer.id === device.id || peer.kind === 'phone') continue;
    const peerFree = availablePorts(lab, peer.id);
    const internetPair = peer.kind === 'internet' || device.kind === 'internet';

    if (internetPair) {
      // The WAN pair only exists between the router and the Internet node (S21, S27).
      const routerSide = peer.kind === 'internet' ? device.kind === 'router' : peer.kind === 'router';
      if (!routerSide || !free.includes('wan') || !peerFree.includes('wan')) continue;
      targets.push({ peer, portId: 'wan', localPort: 'wan' });
      continue;
    }

    const localPort = free.find((portId) => portId !== 'wan');
    if (!localPort) continue;
    for (const portId of peerFree.filter((candidate) => candidate !== 'wan')) {
      targets.push({ peer, portId, localPort });
    }
  }

  return targets;
}

function CableSection({
  lab,
  device,
  dispatch,
}: {
  lab: Lab;
  device: Device;
  dispatch: Dispatch<LabAction>;
}) {
  if (device.kind === 'phone') {
    return (
      <section className="panel__section">
        <h3 className="panel__subtitle">Cable</h3>
        <p className="panel__note">Un móvil no admite cable: solo se conecta por WiFi.</p>
      </section>
    );
  }

  const targets = cableTargets(lab, device);
  if (targets.length === 0) return null;

  const groups = new Map<string, CableTarget[]>();
  for (const target of targets) {
    const rows = groups.get(target.peer.id) ?? [];
    rows.push(target);
    groups.set(target.peer.id, rows);
  }

  return (
    <section className="panel__section">
      <h3 className="panel__subtitle">Conectar por cable</h3>
      {[...groups.values()].map((rows) => (
        <div key={rows[0].peer.id} className="cable-group">
          <p className="cable-group__title">{rows[0].peer.name}</p>
          <ul className="cable-group__list">
            {rows.map((row) => (
              <li key={`${row.peer.id}-${row.portId}`}>
                <button
                  type="button"
                  className="button button--wide"
                  onClick={() =>
                    dispatch({
                      type: 'connect-cable',
                      a: { deviceId: device.id, portId: row.localPort },
                      b: { deviceId: row.peer.id, portId: row.portId },
                    })
                  }
                >
                  {portLabel(row.peer, row.portId)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function CableList({
  lab,
  device,
  dispatch,
}: {
  lab: Lab;
  device: Device;
  dispatch: Dispatch<LabAction>;
}) {
  const links = lab.links.filter(
    (link) => link.a.deviceId === device.id || link.b.deviceId === device.id,
  );
  if (links.length === 0) return null;

  return (
    <section className="panel__section">
      <h3 className="panel__subtitle">Cables</h3>
      <ul className="cables">
        {links.map((link) => {
          const mine = link.a.deviceId === device.id ? link.a : link.b;
          const other = link.a.deviceId === device.id ? link.b : link.a;
          const peer = getDevice(lab, other.deviceId);
          if (!peer) return null;
          return (
            <li key={link.id} className="cables__row">
              <span className="cables__text">
                {portLabel(device, mine.portId)} — {peer.name}
              </span>
              <button
                type="button"
                className="button"
                onClick={() => dispatch({ type: 'disconnect-cable', linkId: link.id })}
              >
                Desconectar
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface SendTarget {
  id: string;
  label: string;
}

/**
 * S23 destination list: every device of another kind, never the origin itself, and the
 * Internet node always listed last under its own name.
 */
function sendTargets(lab: Lab, origin: Device, statuses: Record<string, DeviceStatus>): SendTarget[] {
  const targets = lab.devices
    .filter(
      (candidate) =>
        candidate.id !== origin.id && candidate.kind !== 'internet' && candidate.kind !== 'switch',
    )
    .map((candidate) => ({ id: candidate.id, label: deviceLabel(candidate, statuses[candidate.id]) }));

  const internet = lab.devices.find((candidate) => candidate.kind === 'internet');
  if (internet && origin.kind !== 'internet') targets.push({ id: internet.id, label: 'Internet' });
  return targets;
}

/** Send control of S23: choose a destination, launch the round trip, or say why it cannot go. */
function SendSection({
  device,
  lab,
  statuses,
  busy,
  onSend,
}: {
  device: Device;
  lab: Lab;
  statuses: Record<string, DeviceStatus>;
  busy: boolean;
  onSend: (fromId: string, toId: string) => string | null;
}) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ originId: string; text: string } | null>(null);
  const targets = sendTargets(lab, device, statuses);
  const destination = targets.find((target) => target.id === chosenId) ?? targets[0];

  // Any change in the lab can open a route, so a previous refusal is never left on screen.
  useEffect(() => setFailure(null), [lab]);

  function send() {
    if (!destination) return;
    const problem = onSend(device.id, destination.id);
    setFailure(problem === null ? null : { originId: device.id, text: problem });
  }

  return (
    <section className="panel__section">
      <h3 className="panel__subtitle">Enviar un paquete</h3>
      {destination ? (
        <>
          <div className="field">
            <label className="field__label" htmlFor="send-destination">
              Destino
            </label>
            <select
              id="send-destination"
              className="field__input"
              value={destination.id}
              disabled={busy}
              onChange={(event) => {
                setChosenId(event.target.value);
                setFailure(null);
              }}
            >
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="button button--wide"
            disabled={busy}
            onClick={send}
          >
            Enviar
          </button>
        </>
      ) : (
        <p className="panel__note">No hay ningún otro dispositivo al que enviar.</p>
      )}
      {failure && failure.originId === device.id ? (
        <p className="panel__reason">{failure.text}</p>
      ) : null}
    </section>
  );
}

function occupantOf(lab: Lab, deviceId: string, portId: string): Device | undefined {
  const link = lab.links.find(
    (candidate) =>
      (candidate.a.deviceId === deviceId && candidate.a.portId === portId) ||
      (candidate.b.deviceId === deviceId && candidate.b.portId === portId),
  );
  if (!link) return undefined;
  const mine = link.a.deviceId === deviceId && link.a.portId === portId ? link.a : link.b;
  const peerRef = mine === link.a ? link.b : link.a;
  return getDevice(lab, peerRef.deviceId);
}
