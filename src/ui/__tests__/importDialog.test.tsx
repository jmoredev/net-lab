// @vitest-environment jsdom
/**
 * The import dialog (S53–S57): one field for the four accepted forms, a file, the
 * confirmation of S55 and the six failures of S57, all through the catalogue.
 *
 * jsdom implements no `showModal`, so the component's fallback is what runs here — the same
 * situation the export dialog is tested in. `File.text()` does exist, which is what the file
 * path needs; the clipboard and the download are not part of this dialog.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { createExampleLab } from '../../domain/example';
import type { CaseData, CaseMeta } from '../../domain/case';
import { decodeCase, encodeCase } from '../../domain/case';
import { addDevice, createLab, type Lab } from '../../domain/lab';
import type { Result } from '../../domain/types';
import { translate } from '../../i18n';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import type { MessageKey, MessageParams } from '../../i18n/types';
import { CASE_STORAGE_KEY } from '../caseStorage';
import { ExportDialog } from '../components/ExportDialog';
import { ImportDialog, MAX_IMPORT_FILE_BYTES } from '../components/ImportDialog';
import { STORAGE_KEY } from '../storage';

const meta: CaseMeta = {
  titulo: 'La red no reparte direcciones',
  consigna: 'El portátil de Ana no llega a internet.',
  autor: 'Pareja 7',
};

const example = createExampleLab();

function unwrap(result: Result<Lab>): Lab {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** The lab of a student who has done something: replacing it costs work (S55). */
function ownLab(): Lab {
  return unwrap(addDevice(createLab(), 'router', { x: 560, y: 160 }));
}

/** The payload and the `.json` document of the example case, exactly as the app writes them. */
function encodedExample(): { payload: string; json: string } {
  const encoded = encodeCase({ meta, lab: example });
  if (!encoded.ok) throw new Error(`no se pudo codificar el caso: ${encoded.failure.code}`);
  return encoded;
}

function renderDialog(lab: Lab, onImport = vi.fn(), onClose = vi.fn()) {
  render(
    <LanguageProvider>
      <ImportDialog open lab={lab} onClose={onClose} onImport={onImport} />
    </LanguageProvider>,
  );
  return { onImport, onClose };
}

/** The same dialog with `open` under the test's control, so it can be closed and reopened. */
function renderOpenable(lab: Lab, onImport = vi.fn(), onClose = vi.fn()) {
  const view = (open: boolean) => (
    <LanguageProvider>
      <ImportDialog open={open} lab={lab} onClose={onClose} onImport={onImport} />
    </LanguageProvider>
  );
  const result = render(view(true));
  return { onImport, onClose, setOpen: (open: boolean) => result.rerender(view(open)) };
}

/** A promise the test resolves by hand, to hold a file read in flight (S54). */
function deferred(): { promise: Promise<string>; resolve: (text: string) => void } {
  let resolve: (text: string) => void = () => {};
  const promise = new Promise<string>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** The one field of S53: link, code or document, pasted or typed. */
function field(): HTMLTextAreaElement {
  return screen.getByLabelText('Enlace, código o fichero') as HTMLTextAreaElement;
}

function alertText(): string {
  return screen.getByRole('alert').textContent ?? '';
}

function statusText(): string {
  return screen.getByRole('status').textContent ?? '';
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error('the dialog has no file input');
  return input;
}

function paste(text: string): void {
  // A paste replaces the whole value at once, as `userEvent.type` would not: the payloads
  // here run to thousands of characters.
  fireEvent.change(field(), { target: { value: text } });
}

/** The catalogue sentence of the failure this text produces, as the dialog must compose it. */
function expectedFailure(text: string): string {
  const decoded = decodeCase(text);
  if (decoded.ok) throw new Error('the fixture must not decode');
  const { code, params, detail } = decoded.failure;
  const t = (key: MessageKey, values?: MessageParams): string => translate('es', key, values);
  if (detail === undefined) return t(code, params);
  return t(code, { ...params, detalle: t(detail.code, detail.params) });
}

/** Twenty-one devices: the cap of S47, one over. */
function tooManyDevices(): string {
  const devices = Array.from({ length: 21 }, (_, index) => ({
    k: 'laptop',
    n: `Laptop ${index}`,
    x: 100 + index,
    y: 100,
    eth: true,
    wifi: true,
    asoc: false,
  }));
  return JSON.stringify({ v: 1, lab: { dispositivos: devices, cables: [] } });
}

/** A router with a cable to a port that does not exist: the atomic rejection of S56. */
const badCable = JSON.stringify({
  v: 1,
  lab: {
    router: { lanIp: '192.168.1.1', ssid: 'MI-CASA', dhcp: { desde: 100, hasta: 150 } },
    dispositivos: [
      { k: 'router', n: 'Router', x: 120, y: 80, eth: true, wifi: true, asoc: true },
    ],
    cables: [{ a: [0, 'lan9'], b: ['internet', 'wan'] }],
  },
});

const invalidField = JSON.stringify({
  v: 1,
  lab: {
    dispositivos: [{ k: 'laptop', n: 'Laptop', x: 'no', y: 80, eth: true, wifi: true, asoc: false }],
    cables: [],
  },
});

const futureVersion = JSON.stringify({ v: 2, lab: { dispositivos: [], cables: [] } });

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ImportDialog: one field accepts four forms (S53)', () => {
  const encoded = encodedExample();
  const forms: Array<[string, string]> = [
    ['the full URL', `https://jmoredev.github.io/net-lab/#c=${encoded.payload}`],
    ['the bare fragment', `#c=${encoded.payload}`],
    ['the bare code', encoded.payload],
    ['the .json document', encoded.json],
  ];

  for (const [name, text] of forms) {
    it(`opens the same case from ${name}`, async () => {
      const user = userEvent.setup();
      const { onImport } = renderDialog(createLab());

      paste(text);
      await user.click(screen.getByRole('button', { name: 'Abrir' }));

      await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
      const data = onImport.mock.calls[0][0] as CaseData;
      expect(data.meta).toEqual(meta);
      expect(data.lab.devices.map((device) => device.name)).toEqual(
        example.devices.map((device) => device.name),
      );
      expect(data.lab.links).toHaveLength(example.links.length);
      // The status line names the case and the field is ready for the next one (S56).
      expect(statusText()).toBe(`Caso abierto: ${meta.titulo}`);
      expect(field().value).toBe('');
    });
  }

  it('trims the whitespace a chat adds when pasting', async () => {
    const user = userEvent.setup();
    const { onImport } = renderDialog(createLab());

    paste(`  ${encoded.json}\n\n`);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
  });

  it('opens the link the export dialog builds, without a second analyser (S50, S53)', async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(
      <LanguageProvider>
        <ExportDialog open lab={example} initialMeta={meta} onClose={vi.fn()} onExported={vi.fn()} />
        <ImportDialog open lab={createLab()} onClose={vi.fn()} onImport={onImport} />
      </LanguageProvider>,
    );

    const link = (screen.getByLabelText('Enlace del caso') as HTMLTextAreaElement).value;
    paste(link);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport.mock.calls[0][0].meta).toEqual(meta);
    expect(onImport.mock.calls[0][0].lab.links).toHaveLength(example.links.length);
  });

  it('says the case is untitled when the payload carries no case block (S51)', async () => {
    const user = userEvent.setup();
    const encoded = encodeCase({ meta: null, lab: example });
    if (!encoded.ok) throw new Error(encoded.failure.code);
    const { onImport } = renderDialog(createLab());

    paste(`#c=${encoded.payload}`);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport.mock.calls[0][0].meta).toBeNull();
    expect(statusText()).toBe('Caso abierto: Caso sin título');
  });
});

describe('ImportDialog: the six failures, in plain language (S57)', () => {
  const cases: Array<[string, string]> = [
    ['formato-invalido', 'esto no es un caso'],
    ['version-no-soportada', futureVersion],
    ['esquema-invalido', invalidField],
    ['demasiados-dispositivos', tooManyDevices()],
    ['cable-invalido', badCable],
    ['payload-demasiado-grande', `#c=${'a'.repeat(24_001)}`],
  ];

  for (const [code, text] of cases) {
    it(`shows ${code} through the catalogue and imports nothing`, async () => {
      const user = userEvent.setup();
      const { onImport } = renderDialog(ownLab());

      paste(text);
      await user.click(screen.getByRole('button', { name: 'Abrir' }));

      await waitFor(() => expect(alertText()).toBe(expectedFailure(text)));
      expect(onImport).not.toHaveBeenCalled();
      // Nothing was decoded into the lab: the dialog is still asking for a case.
      expect(statusText()).toBe('');
    });
  }

  it('says which field of the payload is wrong, not a domain path', async () => {
    const user = userEvent.setup();
    renderDialog(ownLab());

    paste(invalidField);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(alertText()).toContain('dispositivos[0].x'));
    expect(alertText()).not.toContain('lab.devices');
  });

  it('composes {detalle} from the sentence the domain already knows (D33)', async () => {
    const user = userEvent.setup();
    renderDialog(ownLab());

    paste(badCable);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(alertText()).toContain('Hay un cable que no se puede conectar: '));
    expect(alertText()).toContain(translate('es', 'port-missing', { port: 'lan9' }));
  });

  it('asks for something to open instead of calling that an invalid case', async () => {
    const user = userEvent.setup();
    const { onImport } = renderDialog(ownLab());

    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(alertText()).toBe('Pega algo primero.');
    expect(onImport).not.toHaveBeenCalled();
  });

  it('keeps the pasted text when the case is rejected, so it can be corrected', async () => {
    const user = userEvent.setup();
    const { onImport } = renderDialog(ownLab());

    paste(badCable);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(alertText()).toContain('Hay un cable que no se puede conectar: '));
    expect(field().value).toBe(badCable);
    expect(onImport).not.toHaveBeenCalled();
  });
});

describe('ImportDialog: confirmation only when there is work to lose (S55)', () => {
  const encoded = encodedExample();

  it('asks before replacing a lab with work, and a no changes nothing', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onImport } = renderDialog(ownLab());

    paste(encoded.payload);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith('Esto reemplaza el laboratorio que tienes abierto. ¿Seguir?');
    expect(onImport).not.toHaveBeenCalled();
    // Nothing is cleared either: the pasted case is still there for a second attempt.
    expect(field().value).toBe(encoded.payload);
    expect(statusText()).toBe('');
  });

  it('replaces the lab when the answer is yes', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onImport } = renderDialog(ownLab());

    paste(encoded.payload);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('does not ask from the example the app preloads', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm');
    const { onImport } = renderDialog(createExampleLab());

    paste(encoded.payload);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not ask from the empty lab of the start', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm');
    const { onImport } = renderDialog(createLab());

    paste(encoded.payload);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('ImportDialog: a file is the same string and the same analyser (S54)', () => {
  const encoded = encodedExample();

  it('imports the .json document chosen in the file input', async () => {
    const user = userEvent.setup();
    const { onImport } = renderDialog(createLab());
    const file = new File([encoded.json], 'netlab-la-red-2024-01-01.json', {
      type: 'application/json',
    });

    fireEvent.change(fileInput(), { target: { files: [file] } });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport.mock.calls[0][0].meta).toEqual(meta);
    expect(statusText()).toBe(`Caso abierto: ${meta.titulo}`);
  });

  it('imports a .txt with the link inside, dropped on the dialog', async () => {
    const user = userEvent.setup();
    const { onImport } = renderDialog(createLab());
    const file = new File([`Mira: https://jmoredev.github.io/net-lab/#c=${encoded.payload}`], 'caso.txt', {
      type: 'text/plain',
    });

    fireEvent.drop(screen.getByRole('dialog'), { dataTransfer: { files: [file] } });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport.mock.calls[0][0].meta).toEqual(meta);
  });

  it('imports a .txt whose link ends with a newline, exactly like the same text pasted', async () => {
    const user = userEvent.setup();
    const { onImport } = renderDialog(createLab());
    const file = new File([`https://jmoredev.github.io/net-lab/#c=${encoded.payload}\n`], 'caso.txt', {
      type: 'text/plain',
    });

    fireEvent.change(fileInput(), { target: { files: [file] } });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    // The field trims what a chat adds; a file is the same string and has to be trimmed too.
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport.mock.calls[0][0].meta).toEqual(meta);
  });

  it('refuses a file over the guard without reading it', async () => {
    const user = userEvent.setup();
    const { onImport } = renderDialog(createLab());
    const big = new File([new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)], 'enorme.json', {
      type: 'application/json',
    });
    const read = vi.fn(() => Promise.resolve(encoded.json));
    Object.defineProperty(big, 'text', { configurable: true, value: read });

    fireEvent.change(fileInput(), { target: { files: [big] } });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() =>
      expect(alertText()).toBe(
        translate('es', 'payload-demasiado-grande', { n: big.size, max: MAX_IMPORT_FILE_BYTES }),
      ),
    );
    expect(read).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('shows the name of the file it is going to open', () => {
    const file = new File([encoded.json], 'netlab-la-red.json', { type: 'application/json' });

    renderDialog(createLab());
    fireEvent.change(fileInput(), { target: { files: [file] } });

    expect(statusText()).toBe('netlab-la-red.json');
  });

  it('treats an unreadable file as an invalid format, never as an exception', async () => {
    const user = userEvent.setup();
    const { onImport } = renderDialog(createLab());
    const broken = new File(['{'], 'roto.json', { type: 'application/json' });
    Object.defineProperty(broken, 'text', {
      configurable: true,
      value: vi.fn(() => Promise.reject(new Error('the file could not be read'))),
    });

    fireEvent.change(fileInput(), { target: { files: [broken] } });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(alertText()).toBe(translate('es', 'formato-invalido')));
    expect(onImport).not.toHaveBeenCalled();
  });

  it('marks itself as the drop target while a file hovers it (S54, S63)', () => {
    renderDialog(createLab());
    const dialog = screen.getByRole('dialog');

    fireEvent.dragOver(dialog);

    expect(dialog.className).toContain('dialog__drop--active');
    // The name stays the title: a dialog is never renamed by a transient visual state, or a
    // screen reader would read the whole hint as its name while the user is dragging a file.
    expect(screen.getByRole('dialog', { name: 'Abrir un caso' })).toBe(dialog);
  });
});

describe('ImportDialog: the dialog itself (S63)', () => {
  it('opens with the focus on the field', () => {
    renderDialog(createLab());

    expect(document.activeElement).toBe(field());
  });

  it('closes through onClose when the cancel event arrives (Escape)', () => {
    const onClose = vi.fn();
    renderDialog(createLab(), vi.fn(), onClose);

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes through onClose from the Cerrar button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog(createLab(), vi.fn(), onClose);

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open after a successful import so the message can be read', async () => {
    const user = userEvent.setup();
    const encoded = encodedExample();
    const onClose = vi.fn();
    renderDialog(createLab(), vi.fn(), onClose);

    paste(`#c=${encoded.payload}`);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(statusText()).toBe(`Caso abierto: ${meta.titulo}`));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('ImportDialog: the same file can be chosen again (S54)', () => {
  it('clears the hidden input after a rejected file, so that path is pickable again', async () => {
    const user = userEvent.setup();
    const { onImport } = renderDialog(createLab());
    const input = fileInput();
    // A browser keeps the chosen path in the input and fires no `change` for the same path again.
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:\\fakepath\\caso.json',
    });

    const rejected = new File([futureVersion], 'caso.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [rejected] } });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await waitFor(() => expect(alertText()).toBe(expectedFailure(futureVersion)));

    expect(fileInput().value).toBe('');

    // Choosable again: the corrected file with the same name now opens the case.
    const good = new File([encodedExample().json], 'caso.json', { type: 'application/json' });
    fireEvent.change(fileInput(), { target: { files: [good] } });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
  });

  it('clears the hidden input when the field becomes the source', () => {
    renderDialog(createLab());
    const input = fileInput();
    Object.defineProperty(input, 'value', {
      configurable: true,
      writable: true,
      value: 'C:\\fakepath\\caso.json',
    });

    fireEvent.change(input, {
      target: { files: [new File([''], 'caso.json', { type: 'application/json' })] },
    });
    paste(badCable);

    // Typing drops the file, and the input has to forget the path with it.
    expect(fileInput().value).toBe('');
  });
});

describe('ImportDialog: reopening starts empty (S53, S54)', () => {
  it('forgets the pasted text and the failure when it is reopened', async () => {
    const user = userEvent.setup();
    const { setOpen } = renderOpenable(ownLab());

    paste(badCable);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await waitFor(() => expect(alertText()).toContain('Hay un cable que no se puede conectar: '));

    setOpen(false);
    setOpen(true);

    expect(field().value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(statusText()).toBe('');
  });

  it('forgets the rejected file, which stops being the source', async () => {
    const user = userEvent.setup();
    const { setOpen } = renderOpenable(createLab());
    const broken = new File(['{'], 'roto.json', { type: 'application/json' });

    fireEvent.change(fileInput(), { target: { files: [broken] } });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await waitFor(() => expect(alertText()).toBe(translate('es', 'formato-invalido')));
    expect(statusText()).toBe('roto.json');

    setOpen(false);
    setOpen(true);

    expect(statusText()).toBe('');
    // The file no longer waits behind the dialog: Abrir asks for something to open.
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(alertText()).toBe('Pega algo primero.');
  });
});

describe('ImportDialog: one import at a time (S54, S56)', () => {
  it('reads the file once when Abrir is clicked twice while the read is pending', async () => {
    const encoded = encodedExample();
    const pending = deferred();
    const read = vi.fn(() => pending.promise);
    const file = new File([''], 'caso.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { configurable: true, value: read });
    const { onImport } = renderDialog(createLab());

    fireEvent.change(fileInput(), { target: { files: [file] } });
    const open = screen.getByRole('button', { name: 'Abrir' });
    fireEvent.click(open);
    fireEvent.click(open);

    // While the read is in flight the action cannot run again.
    expect((open as HTMLButtonElement).disabled).toBe(true);

    pending.resolve(encoded.json);
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(read).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(statusText()).toBe(`Caso abierto: ${meta.titulo}`));
  });

  it('discards a read that arrives after the dialog was closed', async () => {
    const encoded = encodedExample();
    const pending = deferred();
    const file = new File([''], 'caso.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { configurable: true, value: () => pending.promise });
    const { onImport, setOpen } = renderOpenable(createLab());

    fireEvent.change(fileInput(), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    setOpen(false);

    pending.resolve(encoded.json);
    await act(async () => {
      await pending.promise;
    });

    // A result about a dialog that is no longer on screen is stale: it is thrown away.
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('discards a read that outlives its visit when the dialog is reopened', async () => {
    const encoded = encodedExample();
    const pending = deferred();
    const file = new File([''], 'caso.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { configurable: true, value: () => pending.promise });
    const { onImport, setOpen } = renderOpenable(createLab());

    fireEvent.change(fileInput(), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    setOpen(false);
    setOpen(true);

    // The new visit owes nothing to the old read: Abrir must not stay disabled by it.
    const open = screen.getByRole('button', { name: 'Abrir' }) as HTMLButtonElement;
    expect(open.disabled).toBe(false);

    pending.resolve(encoded.json);
    await act(async () => {
      await pending.promise;
    });

    // The read is from the visit that was closed: it applies nothing, not even its failure.
    expect(onImport).not.toHaveBeenCalled();
    expect(statusText()).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('ImportDialog: the header button and the atomic load (S56)', () => {
  it('opens from the header, replaces the lab and stores it with its case', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm');
    const encoded = encodedExample();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Abrir caso' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.change(field(), { target: { value: encoded.json } });
    await user.click(screen.getByRole('button', { name: 'Abrir' }));

    // The case panel appears with the title of the imported document (D32).
    await waitFor(() => expect(screen.getByRole('heading', { name: meta.titulo })).toBeTruthy());
    expect(confirm).not.toHaveBeenCalled();
    // Importing is atomic and persisted: the lab of the case is what the storage holds (S56).
    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"name":"Laptop-1"'),
    );
    expect(window.localStorage.getItem(CASE_STORAGE_KEY)).toContain(meta.titulo);
  });
});
