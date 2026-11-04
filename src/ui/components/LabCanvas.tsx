import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { DeviceStatus } from '../../domain/diagnostics';
import { getDevice, portIsFree, type Lab, type Link } from '../../domain/lab';
import { CAPABILITIES, type Device, type DeviceKind, type Point, type PortRef } from '../../domain/types';
import { ROUND_TRIP_MS, pointAlong, roundTripProgress, routePolyline, routeSegments, type Travel } from '../animation';
import { deviceLabel } from '../format';
import {
  CANVAS,
  DEVICE_SIZE,
  PORT_RADIUS,
  clampPosition,
  deviceCenter,
  findPortAt,
  portAnchorFor,
  portAnchors,
  renderPosition,
  type PortAnchor,
  type PortSide,
} from '../geometry';
import type { LabAction, LabState } from '../labReducer';
import { PALETTE_KINDS, PALETTE_MIME } from '../palette';
import { DeviceGlyph } from './DeviceGlyph';

const GLYPH_SIZE = 40;
const PACKET_RADIUS = 7;
const CAPTION_GAP = 16;
/** Extra room under the box when a bottom port with its name sits there (S32). */
const PORT_LABEL_CLEARANCE = 13;
const SELECTION_INSET = 5;
const TOOLTIP_LINE_HEIGHT = 14;
const TOOLTIP_PADDING = 10;
const TOOLTIP_CHAR_WIDTH = 6.2;
const DELETE_BADGE_RADIUS = 9;
/** Dash pattern of the fictitious wireless leg (S23): there is no cable to draw. */
const WIFI_DASH = '7 6';
const TRASH_SELECTOR = '[data-drop="trash"]';

export interface LabCanvasProps {
  state: LabState;
  statuses: Record<string, DeviceStatus>;
  dispatch: Dispatch<LabAction>;
  /** Packet on its way, owned by App and never part of the lab state (S23). */
  travel: Travel | null;
  /** True while an animation runs: the lab cannot be edited (S23). */
  busy: boolean;
  onTravelEnd: () => void;
  /** Device being dragged, so the palette can show itself as a drop zone (S11). */
  onDeviceDragChange: (id: string | null) => void;
}

interface Tooltip {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: { text: string; tone: 'plain' | 'online' | 'offline' }[];
}

/** Marker of the round trip: where the packet is and which way it is going (S23). */
interface Marker {
  point: Point;
  returning: boolean;
}

export function LabCanvas({
  state,
  statuses,
  dispatch,
  travel,
  busy,
  onTravelEnd,
  onDeviceDragChange,
}: LabCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; offset: Point } | null>(null);
  const cableDragRef = useRef<{ from: PortRef; anchor: Point } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [cableDrag, setCableDrag] = useState<{ from: Point; to: Point } | null>(null);
  const [marker, setMarker] = useState<Marker | null>(null);
  const { lab } = state;
  const isEmpty = lab.devices.every((device) => device.kind === 'internet');

  // The route the marker follows, split per medium: cable legs are solid, wireless dotted.
  const routeLegs = useMemo(
    () => (travel ? routeSegments(lab, travel.from, travel.to) : null),
    [lab, travel],
  );

  const selectedLink = state.selectedLinkId
    ? lab.links.find((link) => link.id === state.selectedLinkId)
    : undefined;
  const badge = selectedLink ? cableMidpoint(lab, selectedLink) : null;

  // One marker, driven by requestAnimationFrame over the round trip (S23). The state of
  // the lab is never touched per frame: only the packet position and its phase move.
  useEffect(() => {
    if (!travel) {
      setMarker(null);
      return;
    }
    const points = routePolyline(lab, travel.from, travel.to);
    if (!points) {
      setMarker(null);
      onTravelEnd();
      return;
    }

    // With reduced motion the route is still shown for the same time, without the marker.
    if (prefersReducedMotion()) {
      setMarker(null);
      const timer = window.setTimeout(() => onTravelEnd(), ROUND_TRIP_MS);
      return () => window.clearTimeout(timer);
    }

    let frame = 0;
    const startedAt = performance.now();
    const step = (now: number) => {
      const elapsed = now - startedAt;
      // The phase comes from the elapsed time, not from the progress value: the way out
      // and the way back inflect at the same moment and the colour must follow it (S23).
      setMarker({
        point: pointAlong(points, roundTripProgress(elapsed, ROUND_TRIP_MS)),
        returning: elapsed >= ROUND_TRIP_MS / 2,
      });
      if (elapsed >= ROUND_TRIP_MS) {
        setMarker(null);
        onTravelEnd();
        return;
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [travel, lab, onTravelEnd]);

  // A selected cable goes away with Supr or Retroceso (S33), never from a text field.
  useEffect(() => {
    const linkId = state.selectedLinkId;
    if (linkId === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if (busy) return;
      event.preventDefault();
      dispatch({ type: 'disconnect-cable', linkId });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.selectedLinkId, busy, dispatch]);

  /** Screen coordinates to canvas coordinates, whatever the SVG is scaled to. */
  function toCanvasPoint(clientX: number, clientY: number): Point {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  }

  function startDrag(event: ReactPointerEvent<SVGGElement>, device: Device) {
    if (busy) return;
    // The Internet node keeps its fixed place (S27).
    if (device.kind === 'internet') return;
    const position = renderPosition(device);
    const point = toCanvasPoint(event.clientX, event.clientY);
    dragRef.current = { id: device.id, offset: { x: point.x - position.x, y: point.y - position.y } };
    setDraggingId(device.id);
    onDeviceDragChange(device.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continueDrag(event: ReactPointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toCanvasPoint(event.clientX, event.clientY);
    dispatch({
      type: 'move-device',
      id: drag.id,
      position: clampPosition({ x: point.x - drag.offset.x, y: point.y - drag.offset.y }),
    });
  }

  function endDrag(event: ReactPointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setDraggingId(null);
    onDeviceDragChange(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // Dropped back on the palette: the device is removed instead of staying on the
    // canvas (S11). The Internet node never gets here, so it is never deleted this way.
    if (isOverTrash(event.clientX, event.clientY)) {
      dispatch({ type: 'delete-device', id: drag.id });
    }
  }

  /** Cable drag (S13): only from a free port, and never instead of a device drag. */
  function startCableDrag(event: ReactPointerEvent<SVGCircleElement>, device: Device, anchor: PortAnchor) {
    if (busy) return;
    if (!portIsFree(lab, device.id, anchor.portId)) return;
    event.stopPropagation();
    cableDragRef.current = { from: { deviceId: device.id, portId: anchor.portId }, anchor: anchor.point };
    setCableDrag({ from: anchor.point, to: anchor.point });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continueCableDrag(event: ReactPointerEvent<SVGCircleElement>) {
    const drag = cableDragRef.current;
    if (!drag) return;
    event.stopPropagation();
    setCableDrag({ from: drag.anchor, to: toCanvasPoint(event.clientX, event.clientY) });
  }

  function endCableDrag(event: ReactPointerEvent<SVGCircleElement>) {
    const drag = cableDragRef.current;
    if (!drag) return;
    cableDragRef.current = null;
    setCableDrag(null);
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const target = findPortAt(lab, toCanvasPoint(event.clientX, event.clientY));
    // Dropped in the void or on the port it started from: cancelled, with no message.
    if (target === null) return;
    if (target.deviceId === drag.from.deviceId && target.portId === drag.from.portId) return;
    // The reducer answers with the exact reason when the pair is not valid (S13, S14).
    dispatch({ type: 'connect-cable', a: drag.from, b: target });
  }

  function cancelCableDrag(event: ReactPointerEvent<SVGCircleElement>) {
    if (!cableDragRef.current) return;
    cableDragRef.current = null;
    setCableDrag(null);
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleDrop(event: DragEvent<SVGSVGElement>) {
    event.preventDefault();
    if (busy) return;
    const raw = event.dataTransfer.getData(PALETTE_MIME) || event.dataTransfer.getData('text/plain');
    const kind = PALETTE_KINDS.find((candidate) => candidate === raw) as DeviceKind | undefined;
    if (!kind) return;
    const point = toCanvasPoint(event.clientX, event.clientY);
    dispatch({
      type: 'add-device',
      kind,
      position: clampPosition({ x: point.x - DEVICE_SIZE / 2, y: point.y - DEVICE_SIZE / 2 }),
    });
  }

  const hovered = state.hoveredId ? getDevice(lab, state.hoveredId) : undefined;
  const tooltip = hovered ? tooltipFor(hovered, statuses[hovered.id]) : null;
  const caption = travel
    ? `Enviando un paquete de ${nameOf(lab, travel.from)} a ${nameOf(lab, travel.to)}`
    : '';

  return (
    <section className="canvas-zone" aria-label="Lienzo" aria-busy={busy}>
      {/* S23 as amended by Q3: the caption names the trip only, with no transformations. */}
      <p className="canvas-zone__caption" aria-live="polite">
        {caption}
      </p>
      <svg
        ref={svgRef}
        className="canvas"
        viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
        role="application"
        aria-label="Lienzo del laboratorio de redes: arrastra los dispositivos para colocarlos y pulsa uno para abrir su panel"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={handleDrop}
      >
        <rect
          className="canvas__background"
          x={0}
          y={0}
          width={CANVAS.width}
          height={CANVAS.height}
          onClick={() => {
            if (busy) return;
            dispatch({ type: 'select', id: null });
            dispatch({ type: 'select-link', linkId: null });
          }}
        />

        {/* Cables first, so a cable never crosses the face of an icon. They run from port
            to port, with the device centre only as a fallback (S13, S32). */}
        <g className="cables">
          {lab.links.map((link) => {
            const ends = cableEnds(lab, link);
            if (!ends) return null;
            const selected = state.selectedLinkId === link.id;
            return (
              <g key={link.id}>
                <line
                  className={`cable${selected ? ' cable--selected' : ''}`}
                  x1={ends.start.x}
                  y1={ends.start.y}
                  x2={ends.end.x}
                  y2={ends.end.y}
                />
                {/* Wide invisible stroke: picking a 2px cable with the pointer is
                    otherwise a lottery (S33). */}
                <line
                  className="cable__hit"
                  x1={ends.start.x}
                  y1={ends.start.y}
                  x2={ends.end.x}
                  y2={ends.end.y}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (busy) return;
                    dispatch({ type: 'select-link', linkId: link.id });
                  }}
                />
              </g>
            );
          })}
          {cableDrag ? (
            <line
              className="cable cable--preview"
              x1={cableDrag.from.x}
              y1={cableDrag.from.y}
              x2={cableDrag.to.x}
              y2={cableDrag.to.y}
              pointerEvents="none"
            />
          ) : null}
        </g>

        {/* The route the packet travels, behind the devices so the icons stay readable.
            One stroke per leg: solid over a cable, dashed over the fictitious WiFi leg (S23). */}
        {travel && routeLegs ? (
          <g className="route" pointerEvents="none">
            {routeLegs.map((leg, index) => (
              <path
                key={`${leg.from.x},${leg.from.y}-${leg.to.x},${leg.to.y}-${index}`}
                className={`route__stroke${marker?.returning ? ' route__stroke--return' : ''}`}
                d={`M ${leg.from.x} ${leg.from.y} L ${leg.to.x} ${leg.to.y}`}
                strokeDasharray={leg.medium === 'wifi' ? WIFI_DASH : undefined}
                pointerEvents="none"
              />
            ))}
          </g>
        ) : null}

        {isEmpty ? (
          <g className="canvas__empty">
            <text x={CANVAS.width / 2} y={CANVAS.height / 2 - 8}>
              El laboratorio está vacío.
            </text>
            <text x={CANVAS.width / 2} y={CANVAS.height / 2 + 18}>
              Arrastra un dispositivo desde la paleta para empezar.
            </text>
          </g>
        ) : null}

        {lab.devices.map((device) => {
          const position = renderPosition(device);
          const status = statuses[device.id];
          const selected = state.selectedId === device.id;
          const offline = Boolean(status?.reason);
          const wifiState = wifiStateOf(device);
          const anchors = portAnchors(device);
          const local = anchors.map((anchor) => ({
            ...anchor,
            local: { x: anchor.point.x - position.x, y: anchor.point.y - position.y },
          }));
          const hasBottomPort = anchors.some((anchor) => anchor.side === 'bottom');
          const captionY = DEVICE_SIZE + CAPTION_GAP + (hasBottomPort ? PORT_LABEL_CLEARANCE : 0);
          return (
            <g
              key={device.id}
              className={`device${draggingId === device.id ? ' device--dragging' : ''}`}
              transform={`translate(${position.x} ${position.y})`}
              data-device-id={device.id}
              onPointerDown={(event) => startDrag(event, device)}
              onPointerMove={continueDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerEnter={() => dispatch({ type: 'hover', id: device.id })}
              onPointerLeave={() => dispatch({ type: 'hover', id: null })}
              onClick={(event) => {
                event.stopPropagation();
                if (busy) return;
                dispatch({ type: 'select', id: device.id });
              }}
            >
              {selected ? (
                <rect
                  className="device__selection"
                  x={-SELECTION_INSET}
                  y={-SELECTION_INSET}
                  width={DEVICE_SIZE + SELECTION_INSET * 2}
                  height={DEVICE_SIZE + SELECTION_INSET * 2}
                  rx={16}
                />
              ) : null}
              <rect
                className={`device__box${offline ? ' device__box--offline' : ''}`}
                width={DEVICE_SIZE}
                height={DEVICE_SIZE}
                rx={12}
              />
              <g transform={`translate(${(DEVICE_SIZE - GLYPH_SIZE) / 2} ${(DEVICE_SIZE - GLYPH_SIZE) / 2 - 4})`}>
                <DeviceGlyph kind={device.kind} size={GLYPH_SIZE} />
              </g>
              {wifiState ? <WifiMark state={wifiState} /> : null}
              <text
                className="device__caption"
                x={DEVICE_SIZE / 2}
                y={captionY}
                textAnchor="middle"
              >
                {deviceLabel(device, status)}
              </text>

              {/* Ports on the border of the box, each with its name (S32). */}
              {local.map((anchor) => {
                const free = portIsFree(lab, device.id, anchor.portId);
                const label = portLabelPlacement(anchor.side);
                return (
                  <g key={anchor.portId}>
                    <circle
                      className={`port ${free ? 'port--free' : 'port--used'}`}
                      cx={anchor.local.x}
                      cy={anchor.local.y}
                      r={PORT_RADIUS}
                      role="button"
                      aria-label={`${device.name}, ${anchor.fullLabel}`}
                      onPointerDown={(event) => startCableDrag(event, device, anchor)}
                      onPointerMove={continueCableDrag}
                      onPointerUp={endCableDrag}
                      onPointerCancel={cancelCableDrag}
                    >
                      <title>{anchor.fullLabel}</title>
                    </circle>
                    <text
                      className="port__label"
                      x={anchor.local.x + label.dx}
                      y={anchor.local.y + label.dy}
                      textAnchor={label.anchor}
                    >
                      {anchor.label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Delete badge of the selected cable, above everything else (S33). */}
        {badge && selectedLink ? (
          <g
            className="cable__badge"
            transform={`translate(${badge.x} ${badge.y})`}
            role="button"
            aria-label="Eliminar el cable seleccionado"
            onClick={(event) => {
              event.stopPropagation();
              if (busy) return;
              dispatch({ type: 'disconnect-cable', linkId: selectedLink.id });
            }}
          >
            <circle r={DELETE_BADGE_RADIUS} />
            <text textAnchor="middle" y={4}>
              ×
            </text>
          </g>
        ) : null}

        {marker ? (
          <circle
            className={`packet${marker.returning ? ' packet--return' : ''}`}
            cx={marker.point.x}
            cy={marker.point.y}
            r={PACKET_RADIUS}
            pointerEvents="none"
          />
        ) : null}

        {tooltip ? (
          <g className="tooltip" transform={`translate(${tooltip.x} ${tooltip.y})`} pointerEvents="none">
            <rect width={tooltip.width} height={tooltip.height} rx={8} />
            {tooltip.lines.map((line, index) => (
              <text
                key={`${line.text}-${index}`}
                className={`tooltip__line tooltip__line--${line.tone}`}
                x={TOOLTIP_PADDING}
                y={TOOLTIP_PADDING + TOOLTIP_LINE_HEIGHT * (index + 1) - 3}
              >
                {line.text}
              </text>
            ))}
          </g>
        ) : null}
      </svg>
    </section>
  );
}

/** The three WiFi states of the canvas mark (S34). */
type WifiState = 'online' | 'off' | 'disconnected';

const WIFI_STATE_CLASS: Record<WifiState, string> = {
  online: 'device__wifi--online',
  off: 'device__wifi--off',
  disconnected: 'device__wifi--disconnected',
};

const WIFI_STATE_TITLE: Record<WifiState, string> = {
  online: 'WiFi conectado',
  off: 'WiFi desactivado',
  disconnected: 'WiFi sin conectar',
};

/**
 * WiFi state of a device (S34): the router is connected while it broadcasts, a client is
 * connected when it is associated, off while its interface is down, and disconnected when
 * the interface is up but it has not joined the network. `null` for the devices without
 * WiFi, which keep no mark at all.
 */
function wifiStateOf(device: Device): WifiState | null {
  if (!CAPABILITIES[device.kind].wifi) return null;
  if (!device.wifiEnabled) return 'off';
  if (device.kind === 'router') return 'online';
  return device.wifiAssociated ? 'online' : 'disconnected';
}

/** WiFi state on the canvas (S10, S34): green when connected, grey when off, red when not joined. */
function WifiMark({ state }: { state: WifiState }) {
  return (
    <g
      className={`device__wifi ${WIFI_STATE_CLASS[state]}`}
      transform={`translate(${DEVICE_SIZE - 22} 7)`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      pointerEvents="none"
    >
      <title>{WIFI_STATE_TITLE[state]}</title>
      <path d="M0 4.5a10 10 0 0 1 12 0" />
      <path d="M2.4 7.8a6.4 6.4 0 0 1 7.2 0" />
      <path d="M4.8 11a2.8 2.8 0 0 1 2.4 0" />
    </g>
  );
}

/** Endpoints of a cable: the port it is plugged into, or the device centre as a fallback. */
function cableEnds(lab: Lab, link: Link): { start: Point; end: Point } | null {
  const from = getDevice(lab, link.a.deviceId);
  const to = getDevice(lab, link.b.deviceId);
  if (!from || !to) return null;
  return {
    start: portAnchorFor(lab, link.a) ?? deviceCenter(from),
    end: portAnchorFor(lab, link.b) ?? deviceCenter(to),
  };
}

function cableMidpoint(lab: Lab, link: Link): Point | null {
  const ends = cableEnds(lab, link);
  if (!ends) return null;
  return { x: (ends.start.x + ends.end.x) / 2, y: (ends.start.y + ends.end.y) / 2 };
}

/** Port name next to the dot, pushed away from the box so it never covers the icon. */
function portLabelPlacement(side: PortSide): {
  dx: number;
  dy: number;
  anchor: 'middle' | 'start' | 'end';
} {
  switch (side) {
    case 'top':
      return { dx: 0, dy: -PORT_RADIUS - 4, anchor: 'middle' };
    case 'bottom':
      return { dx: 0, dy: PORT_RADIUS + 8, anchor: 'middle' };
    case 'left':
      return { dx: -PORT_RADIUS - 4, dy: 3.5, anchor: 'end' };
    case 'right':
      return { dx: PORT_RADIUS + 4, dy: 3.5, anchor: 'start' };
  }
}

/** Was the pointer released over the palette, which acts as the trash zone (S11)? */
function isOverTrash(clientX: number, clientY: number): boolean {
  if (typeof document.elementFromPoint !== 'function') return false;
  // `closest` is undefined when nothing is under the pointer, and comparing that with
  // null made "released outside the page" read as "over the trash".
  return Boolean(document.elementFromPoint(clientX, clientY)?.closest(TRASH_SELECTOR));
}

function nameOf(lab: Lab, deviceId: string): string {
  return getDevice(lab, deviceId)?.name ?? 'un dispositivo';
}

/** Some students ask their system for less motion; then the route shows without the marker. */
function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Hover summary (S29): name, IP when it has one and whether it has Internet access. */
function tooltipFor(device: Device, status: DeviceStatus | undefined): Tooltip {
  const position = renderPosition(device);
  const ip = status?.ip ?? null;
  const hasInternet = status?.hasInternet ?? false;
  const lines: Tooltip['lines'] = [{ text: device.name, tone: 'plain' }];
  if (ip) lines.push({ text: ip, tone: 'plain' });
  lines.push({
    text: hasInternet ? 'Con salida a Internet' : 'Sin salida a Internet',
    tone: hasInternet ? 'online' : 'offline',
  });

  const longest = lines.reduce((width, line) => Math.max(width, line.text.length), 0);
  const width = longest * TOOLTIP_CHAR_WIDTH + TOOLTIP_PADDING * 2;
  const height = lines.length * TOOLTIP_LINE_HEIGHT + TOOLTIP_PADDING * 2 - 6;
  const centred = position.x + DEVICE_SIZE / 2 - width / 2;
  const x = Math.min(Math.max(centred, 8), CANVAS.width - width - 8);
  const above = position.y - height - 12;
  const y = above >= 8 ? above : position.y + DEVICE_SIZE + CAPTION_GAP + 12;

  return { x, y, width, height, lines };
}
