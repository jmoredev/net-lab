import { useRef, useState, type Dispatch, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { DeviceStatus } from '../../domain/diagnostics';
import { getDevice } from '../../domain/lab';
import { CAPABILITIES, type Device, type DeviceKind, type Point } from '../../domain/types';
import { deviceLabel } from '../format';
import { CANVAS, DEVICE_SIZE, clampPosition, deviceCenter, renderPosition } from '../geometry';
import type { LabAction, LabState } from '../labReducer';
import { DeviceGlyph } from './DeviceGlyph';
import { PALETTE_KINDS, PALETTE_MIME } from './DevicePalette';

const GLYPH_SIZE = 40;
const CAPTION_GAP = 16;
const SELECTION_INSET = 5;
const TOOLTIP_LINE_HEIGHT = 14;
const TOOLTIP_PADDING = 10;
const TOOLTIP_CHAR_WIDTH = 6.2;

export interface LabCanvasProps {
  state: LabState;
  statuses: Record<string, DeviceStatus>;
  dispatch: Dispatch<LabAction>;
}

interface Tooltip {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: { text: string; tone: 'plain' | 'online' | 'offline' }[];
}

export function LabCanvas({ state, statuses, dispatch }: LabCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; offset: Point } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const { lab } = state;
  const isEmpty = lab.devices.every((device) => device.kind === 'internet');

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
    // The Internet node keeps its fixed place (S27).
    if (device.kind === 'internet') return;
    const position = renderPosition(device);
    const point = toCanvasPoint(event.clientX, event.clientY);
    dragRef.current = { id: device.id, offset: { x: point.x - position.x, y: point.y - position.y } };
    setDraggingId(device.id);
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
    if (!dragRef.current) return;
    dragRef.current = null;
    setDraggingId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleDrop(event: DragEvent<SVGSVGElement>) {
    event.preventDefault();
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

  return (
    <section className="canvas-zone" aria-label="Lienzo">
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
          onClick={() => dispatch({ type: 'select', id: null })}
        />

        {/* Cables first, so a cable never crosses the face of an icon. */}
        <g className="cables">
          {lab.links.map((link) => {
            const from = getDevice(lab, link.a.deviceId);
            const to = getDevice(lab, link.b.deviceId);
            if (!from || !to) return null;
            const start = deviceCenter(from);
            const end = deviceCenter(to);
            return (
              <line
                key={link.id}
                className="cable"
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
              />
            );
          })}
        </g>

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
              {CAPABILITIES[device.kind].wifi ? <WifiMark on={device.wifiEnabled} /> : null}
              <text
                className="device__caption"
                x={DEVICE_SIZE / 2}
                y={DEVICE_SIZE + CAPTION_GAP}
                textAnchor="middle"
              >
                {deviceLabel(device, status)}
              </text>
            </g>
          );
        })}

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

/** WiFi state on the canvas (S10): on when the interface is enabled, faded when it is off. */
function WifiMark({ on }: { on: boolean }) {
  return (
    <g
      className={`device__wifi${on ? '' : ' device__wifi--off'}`}
      transform={`translate(${DEVICE_SIZE - 22} 7)`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      pointerEvents="none"
    >
      <path d="M0 4.5a10 10 0 0 1 12 0" />
      <path d="M2.4 7.8a6.4 6.4 0 0 1 7.2 0" />
      <path d="M4.8 11a2.8 2.8 0 0 1 2.4 0" />
    </g>
  );
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
