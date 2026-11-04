// @vitest-environment jsdom
/**
 * Interaction tier: the real application, mounted in a DOM and driven the way a student
 * drives it with the keyboard and the pointer. Only this file runs under jsdom; the rest
 * of the suite stays on `node` and keeps its speed.
 *
 * Every query goes through what the student can see or read (role, label, visible text)
 * and every assertion uses the exact wording of the specification (S22, S25, S28, S33).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';

type User = ReturnType<typeof userEvent.setup>;

interface Point {
  x: number;
  y: number;
}

/* ------------------------------------------------------------------------------------
 * jsdom gaps
 *
 * jsdom has no layout, so the pointer path of the canvas cannot run at all without the
 * fakes below: no pointer capture, no SVG screen matrix, and no hit testing.
 * ---------------------------------------------------------------------------------- */

/** What `document.elementFromPoint` answers: jsdom never paints, so the test decides. */
let elementUnderPointer: Element | null = null;

const undo: (() => void)[] = [];

/** Installs one fake and remembers how to put the environment back afterwards. */
function install(owner: object, key: string, value: unknown): void {
  const record = owner as Record<string, unknown>;
  const hadOwn = Object.prototype.hasOwnProperty.call(record, key);
  const previous = record[key];
  record[key] = value;
  undo.push(() => {
    if (hadOwn) record[key] = previous;
    else delete record[key];
  });
}

const confirmSpy = vi.fn(() => false);

beforeAll(() => {
  // Pointer capture: absent in jsdom, so it is a no-op and nothing is ever captured.
  install(Element.prototype, 'setPointerCapture', () => {});
  install(Element.prototype, 'releasePointerCapture', () => {});
  install(Element.prototype, 'hasPointerCapture', () => false);

  // The SVG coordinate pair used by the canvas. A browser scales the viewBox, so the real
  // implementation maps client coordinates through the inverse screen matrix; jsdom has no
  // matrix, so the identity is the honest fake: the point the component filled in from the
  // event's clientX/clientY comes back unchanged and lands on the same canvas coordinate.
  install(SVGSVGElement.prototype, 'createSVGPoint', () => ({
    x: 0,
    y: 0,
    matrixTransform(this: Point): Point {
      return { x: this.x, y: this.y };
    },
  }));
  install(SVGSVGElement.prototype, 'getScreenCTM', () => ({ inverse: () => ({}) }));

  install(document, 'elementFromPoint', () => elementUnderPointer);
  install(window, 'confirm', confirmSpy);
});

afterAll(() => {
  for (const restore of undo.reverse()) restore();
  undo.length = 0;
});

beforeEach(() => {
  localStorage.clear();
  confirmSpy.mockClear();
  // A browser always answers with the element under the pointer while it is on the page.
  elementUnderPointer = document.body;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  elementUnderPointer = null;
});

/* ------------------------------------------------------------------------------------
 * Driving the app
 * ---------------------------------------------------------------------------------- */

function renderApp(): { user: User; container: HTMLElement } {
  const user = userEvent.setup();
  const view = render(<App />);
  return { user, container: view.container };
}

type PointerStep = 'pointerDown' | 'pointerMove' | 'pointerUp';

/** One pointer step at explicit screen coordinates. */
function pointer(step: PointerStep, target: Element, at: Point): void {
  fireEvent[step](target, {
    clientX: at.x,
    clientY: at.y,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    buttons: step === 'pointerUp' ? 0 : 1,
    isPrimary: true,
  });
}

/** Canvas coordinates of a port dot, read from what the canvas actually rendered (S32). */
function canvasPointOf(element: Element): Point {
  const translate = /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/;
  let x = Number(element.getAttribute('cx') ?? 0);
  let y = Number(element.getAttribute('cy') ?? 0);
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    const match = translate.exec(node.getAttribute('transform') ?? '');
    if (match === null) continue;
    x += Number(match[1]);
    y += Number(match[2]);
  }
  return { x, y };
}

/**
 * Canvas caption of a device: the first `<text>` with that content. The hover summary
 * repeats the device name further down the document (S29), so document order decides.
 */
function canvasCaption(text: string): Element {
  const captions = screen
    .getAllByText(text)
    .filter((node) => node.tagName.toLowerCase() === 'text');
  expect(captions.length).toBeGreaterThan(0);
  return captions[0];
}

/** Clicks a device on the canvas, the way a student opens its panel (S29). */
async function clickDevice(user: User, caption: string): Promise<void> {
  await user.click(canvasCaption(caption));
}

/**
 * WiFi marks of the canvas in the given state (S34). The state is carried by the SVG
 * `<title>` of the mark, which hangs off a `<g>` and therefore is not reachable through
 * `getByTitle` (that query only accepts `<svg><title>`), so the text is selected directly.
 */
function wifiMarks(state: 'WiFi conectado' | 'WiFi desactivado' | 'WiFi sin conectar'): Element[] {
  return screen.queryAllByText(state).filter((node) => node.tagName.toLowerCase() === 'title');
}

/** Adds a device from the palette by clicking its button (S6, S7). */
async function addDevice(user: User, label: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: label }));
}

function portDot(label: string): Element {
  return screen.getByRole('button', { name: label });
}

/** Drags a cable from one free port dot to another (S13). */
function dragPortToPort(from: Element, to: Element): void {
  const start = canvasPointOf(from);
  const end = canvasPointOf(to);
  pointer('pointerDown', from, start);
  pointer('pointerMove', from, end);
  pointer('pointerUp', from, end);
}

/**
 * The wide invisible stroke that makes a cable clickable (S33). A cable has no accessible
 * name, so it is picked from the two `<line>` elements drawn for it: the visible stroke
 * first, its hit twin second.
 */
function cableHitTarget(container: HTMLElement): Element {
  const lines = Array.from(container.querySelectorAll('line'));
  const hit = lines[1];
  expect(hit).toBeDefined();
  return hit;
}

/** Router and laptop cabled through the panel, which lists the free ports (S13). */
async function cableRouterAndLaptop(user: User): Promise<void> {
  await addDevice(user, 'Router');
  await addDevice(user, 'Portátil');
  await user.click(screen.getByRole('button', { name: 'LAN 1' }));
}

/* ------------------------------------------------------------------------------------
 * 1-2. Adding devices from the palette
 * ---------------------------------------------------------------------------------- */

describe('adding a device', () => {
  it('puts a laptop on the canvas with its default name and opens its panel', async () => {
    const { user } = renderApp();
    expect(screen.getByText('El laboratorio está vacío.')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Portátil' }));

    // The empty state is gone and the device is drawn with the default name of S25.
    expect(screen.queryByText('El laboratorio está vacío.')).toBeNull();
    expect(canvasCaption('Portátil-1')).not.toBeNull();

    const panel = screen.getByRole('complementary', { name: 'Panel del dispositivo seleccionado' });
    expect(panel.textContent).toContain('Portátil');
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Portátil-1');
  });

  it('refuses a second router and says so on the palette (D17)', async () => {
    const { user } = renderApp();

    await addDevice(user, 'Router');

    const routerButton = screen.getByRole('button', { name: 'Router' });
    expect((routerButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Ya hay un router en el laboratorio.')).not.toBeNull();

    // Pressing it again changes nothing: there is still exactly one router on the canvas.
    await user.click(routerButton);
    expect(screen.getAllByRole('button', { name: 'Router, WAN' })).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------------------------
 * 3-4. Renaming (S25)
 * ---------------------------------------------------------------------------------- */

describe('renaming a device', () => {
  it('shows the new name on the canvas after Enter in the name field', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Portátil');

    const nameField = screen.getByLabelText('Nombre');
    await user.clear(nameField);
    await user.type(nameField, 'Equipo de Ana{Enter}');

    expect(canvasCaption('Equipo de Ana')).not.toBeNull();
    expect(screen.queryByText('Portátil-1')).toBeNull();
  });

  it('rejects an empty name with the exact message and keeps the old one', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Portátil');

    const nameField = screen.getByLabelText('Nombre');
    await user.clear(nameField);
    await user.type(nameField, '{Enter}');

    expect(screen.getByText('El nombre no puede estar vacío.')).not.toBeNull();
    expect(canvasCaption('Portátil-1')).not.toBeNull();
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Portátil-1');
  });
});

/* ------------------------------------------------------------------------------------
 * 5-6. Manual addressing, rows 6 and 8 of the diagnostic table (S20, S22, D18)
 * ---------------------------------------------------------------------------------- */

describe('manual addressing', () => {
  it('reports an IP outside the router subnet as row 6 of S22', async () => {
    const { user } = renderApp();
    await cableRouterAndLaptop(user);
    expect(screen.getAllByText('Ocupado por Router')).toHaveLength(1);

    await user.selectOptions(screen.getByLabelText('Dirección IP'), 'manual');
    const manualIp = screen.getByLabelText('IP manual');
    await user.clear(manualIp);
    await user.type(manualIp, '10.0.0.5{Enter}');

    expect(screen.getByText('La IP 10.0.0.5 no pertenece a la subred 192.168.1.0.')).not.toBeNull();
  });

  it('reports a wrong gateway as row 8 of S22', async () => {
    const { user } = renderApp();
    await cableRouterAndLaptop(user);

    await user.selectOptions(screen.getByLabelText('Dirección IP'), 'manual');
    const manualIp = screen.getByLabelText('IP manual');
    await user.clear(manualIp);
    await user.type(manualIp, '192.168.1.40{Enter}');
    expect(screen.queryByText(/^La puerta de enlace/)).toBeNull();

    const gateway = screen.getByLabelText('Puerta de enlace');
    await user.clear(gateway);
    await user.type(gateway, '192.168.1.99{Enter}');

    expect(
      screen.getByText('La puerta de enlace 192.168.1.99 no es la del router (192.168.1.1).'),
    ).not.toBeNull();
  });
});

/* ------------------------------------------------------------------------------------
 * 7. DHCP range: an empty field reverts, it is not an error (S28)
 * ---------------------------------------------------------------------------------- */

describe('DHCP range', () => {
  it('reverts an empty start field without a banner and keeps the previous value', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Router');

    const start = screen.getByLabelText('Rango DHCP: desde') as HTMLInputElement;
    expect(start.value).toBe('2');

    await user.clear(start);
    await user.tab();

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByLabelText('Rango DHCP: desde')).toBe(start);
    expect(start.value).toBe('2');
  });
});

/* ------------------------------------------------------------------------------------
 * 8. The three WiFi states (S10, S34)
 * ---------------------------------------------------------------------------------- */

describe('WiFi states', () => {
  it('goes from the red mark to green when the phone joins and back to red when the router turns WiFi off', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Router');
    await addDevice(user, 'Móvil');

    // The phone has WiFi on but has not joined yet: red mark. The router emits: green mark.
    expect(wifiMarks('WiFi sin conectar')).toHaveLength(1);
    expect(wifiMarks('WiFi conectado')).toHaveLength(1);
    expect(wifiMarks('WiFi desactivado')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Conectar a la WiFi' }));
    expect(wifiMarks('WiFi conectado')).toHaveLength(2);
    expect(wifiMarks('WiFi sin conectar')).toHaveLength(0);

    await clickDevice(user, 'Router · 192.168.1.1');
    const routerWifi = screen.getByLabelText('WiFi') as HTMLInputElement;
    expect(routerWifi.checked).toBe(true);
    await user.click(routerWifi);

    expect(routerWifi.checked).toBe(false);
    expect(wifiMarks('WiFi desactivado')).toHaveLength(1);
    expect(wifiMarks('WiFi sin conectar')).toHaveLength(1);
    expect(wifiMarks('WiFi conectado')).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------------------------
 * 9-10. Cables dragged from port to port (S13, S32)
 * ---------------------------------------------------------------------------------- */

describe('cabling from port to port', () => {
  it('creates one cable and shows both ports as occupied in the panel', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Router');
    await addDevice(user, 'Portátil');

    dragPortToPort(portDot('Portátil-1, Ethernet'), portDot('Router, LAN 1'));

    // The laptop panel lists its only port as taken by the router.
    expect(screen.getAllByText('Ocupado por Router')).toHaveLength(1);

    await clickDevice(user, 'Router · 192.168.1.1');
    expect(screen.getAllByText('Ocupado por Portátil-1')).toHaveLength(1);
    // WAN, LAN 2, LAN 3 and LAN 4 are still free.
    expect(screen.getAllByText('Libre')).toHaveLength(4);
  });

  it('refuses to start a second cable from a port that is already taken', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Router');
    await addDevice(user, 'Portátil');
    dragPortToPort(portDot('Portátil-1, Ethernet'), portDot('Router, LAN 1'));

    dragPortToPort(portDot('Portátil-1, Ethernet'), portDot('Router, LAN 2'));

    // No cable was created and no reason was raised: the port is simply not a source.
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getAllByText('Ocupado por Router')).toHaveLength(1);

    await clickDevice(user, 'Router · 192.168.1.1');
    expect(screen.getAllByText('Ocupado por Portátil-1')).toHaveLength(1);
    expect(screen.getAllByText('Libre')).toHaveLength(4);
  });
});

/* ------------------------------------------------------------------------------------
 * 11. Deleting a cable with the keyboard (S33)
 * ---------------------------------------------------------------------------------- */

describe('deleting a cable with the keyboard', () => {
  it('removes the selected cable with Supr and keeps it when the key comes from a text field', async () => {
    const { user, container } = renderApp();
    await addDevice(user, 'Router');
    await addDevice(user, 'Portátil');
    dragPortToPort(portDot('Portátil-1, Ethernet'), portDot('Router, LAN 1'));
    expect(screen.getAllByText('Ocupado por Router')).toHaveLength(1);

    // Clicking the cable selects it and shows its delete badge.
    await user.click(cableHitTarget(container));
    expect(screen.getByRole('button', { name: 'Eliminar el cable seleccionado' })).not.toBeNull();

    await user.keyboard('{Delete}');

    expect(screen.queryByRole('button', { name: 'Eliminar el cable seleccionado' })).toBeNull();
    expect(screen.getAllByText('Libre')).toHaveLength(1);
    expect(screen.queryByText(/^Ocupado por/)).toBeNull();

    // A second cable, selected, must survive a Delete typed into a text field.
    dragPortToPort(portDot('Portátil-1, Ethernet'), portDot('Router, LAN 1'));
    await user.click(cableHitTarget(container));
    expect(screen.getByRole('button', { name: 'Eliminar el cable seleccionado' })).not.toBeNull();

    const nameField = screen.getByLabelText('Nombre');
    await user.click(nameField);
    await user.type(nameField, '{Delete}');

    expect(screen.getByRole('button', { name: 'Eliminar el cable seleccionado' })).not.toBeNull();
    expect(screen.getAllByText('Ocupado por Router')).toHaveLength(1);
  });

  it('removes the selected cable with its delete badge too (S33)', async () => {
    const { user, container } = renderApp();
    await addDevice(user, 'Router');
    await addDevice(user, 'Portátil');
    dragPortToPort(portDot('Portátil-1, Ethernet'), portDot('Router, LAN 1'));

    await user.click(cableHitTarget(container));
    await user.click(screen.getByRole('button', { name: 'Eliminar el cable seleccionado' }));

    expect(screen.queryByRole('button', { name: 'Eliminar el cable seleccionado' })).toBeNull();
    expect(screen.queryByText(/^Ocupado por/)).toBeNull();
    expect(screen.getAllByText('Libre')).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------------------------
 * 12. Deleting a device by dropping it on the palette (S11, S27)
 * ---------------------------------------------------------------------------------- */

describe('deleting a device on the palette', () => {
  it('removes a laptop dragged back to the palette and leaves the Internet node alone', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Portátil');

    const palette = screen.getByRole('complementary', { name: 'Paleta de dispositivos' });
    const laptop = canvasCaption('Portátil-1');
    const start = { x: 200, y: 260 };

    pointer('pointerDown', laptop, start);
    pointer('pointerMove', laptop, { x: 220, y: 300 });
    // While the device is dragged, the palette offers itself as the drop zone (S11).
    expect(screen.getByText('Suelta aquí para eliminar')).not.toBeNull();

    elementUnderPointer = palette;
    pointer('pointerUp', laptop, { x: 240, y: 320 });

    expect(screen.queryByText('Portátil-1')).toBeNull();
    expect(screen.getByText('El laboratorio está vacío.')).not.toBeNull();
    // Dropping a device on the palette removes it without asking anything (S11).
    expect(confirmSpy).not.toHaveBeenCalled();

    // The Internet node never leaves the canvas, whatever the student drags it onto (S27).
    const internet = canvasCaption('Internet');
    pointer('pointerDown', internet, { x: 1000, y: 100 });
    pointer('pointerMove', internet, { x: 600, y: 300 });
    elementUnderPointer = palette;
    pointer('pointerUp', internet, { x: 400, y: 320 });

    expect(screen.getAllByRole('button', { name: 'Internet, WAN' })).toHaveLength(1);
  });

  /**
   * Regression pin for `isOverTrash`: a browser answers null when the pointer is released
   * outside the viewport, and that used to read as "over the palette" and delete the device.
   */
  it('keeps a device when nothing is under the pointer on release', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Portátil');

    const laptop = canvasCaption('Portátil-1');
    pointer('pointerDown', laptop, { x: 200, y: 260 });
    pointer('pointerMove', laptop, { x: 220, y: 300 });

    elementUnderPointer = null;
    pointer('pointerUp', laptop, { x: 240, y: 320 });

    expect(screen.queryByText('Portátil-1')).not.toBeNull();
  });

  /**
   * The Internet node ignores the drag silently on purpose (S27), so the reason lives in its
   * read-only panel: a banner on every click would punish a plain selection. This replaces a
   * marker that used to demand the domain deletion message on the drop itself.
   */
  it('explains on its panel that the Internet node is fixed and cannot be deleted', async () => {
    const { user } = renderApp();
    await addDevice(user, 'Portátil');

    const internet = canvasCaption('Internet');
    pointer('pointerDown', internet, { x: 1000, y: 100 });
    pointer('pointerMove', internet, { x: 600, y: 300 });
    elementUnderPointer = screen.getByRole('complementary', { name: 'Paleta de dispositivos' });
    pointer('pointerUp', internet, { x: 400, y: 320 });

    // The node survives the drag attempt, and its panel states why it cannot be removed.
    expect(canvasCaption('Internet')).not.toBeNull();
    await clickDevice(user, 'Internet');
    expect(
      screen.getByText('El nodo Internet está fijo: no se puede mover ni eliminar.'),
    ).not.toBeNull();
  });
});
