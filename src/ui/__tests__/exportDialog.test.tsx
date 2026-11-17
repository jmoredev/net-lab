// @vitest-environment jsdom
/**
 * The export dialog (S49–S52): what a student sees when they share the lab on screen.
 *
 * jsdom implements no `showModal`, no `navigator.clipboard` and no `document.execCommand`, so
 * the component's fallbacks are what runs here — which is exactly the point: the two outputs
 * have to work without the modern APIs. The download is stubbed, because a browser download
 * cannot be observed from jsdom (the manual checklist covers the real one).
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaseMeta } from '../../domain/case';
import { decodeCase } from '../../domain/case';
import { createExampleLab } from '../../domain/example';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { App } from '../../App';
import { ExportDialog } from '../components/ExportDialog';
import { downloadText } from '../download';

vi.mock('../download', () => ({ downloadText: vi.fn() }));

const meta: CaseMeta = {
  titulo: 'Portátil de Nuño',
  consigna: 'El portátil de Ana no llega a internet.',
  autor: 'Pareja 7',
};

const lab = createExampleLab();

/** The link the dialog is showing: the read-only textarea labelled with the catalogue string. */
function linkField(): HTMLTextAreaElement {
  return screen.getByLabelText('Enlace del caso') as HTMLTextAreaElement;
}

function statusText(): string {
  return screen.getByRole('status').textContent ?? '';
}

/** Puts a fake clipboard on the instance, shadowing anything jsdom may add later. */
function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(writeText) },
  });
}

function renderDialog(initialMeta: CaseMeta | null, onExported = vi.fn(), onClose = vi.fn()): void {
  render(
    <LanguageProvider>
      <ExportDialog
        open
        lab={lab}
        initialMeta={initialMeta}
        onClose={onClose}
        onExported={onExported}
      />
    </LanguageProvider>,
  );
}

/** The same dialog with `open` under the test's control, so it can be closed and reopened. */
function renderOpenable(initialMeta: CaseMeta | null): (open: boolean) => void {
  const view = (open: boolean) => (
    <LanguageProvider>
      <ExportDialog
        open={open}
        lab={lab}
        initialMeta={initialMeta}
        onClose={vi.fn()}
        onExported={vi.fn()}
      />
    </LanguageProvider>
  );
  const result = render(view(true));
  return (open: boolean) => result.rerender(view(open));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.mocked(downloadText).mockClear();
  delete (window.navigator as unknown as Record<string, unknown>).clipboard;
  delete (document as unknown as Record<string, unknown>).execCommand;
});

describe('ExportDialog: the three optional fields (S51)', () => {
  it('prefills title, brief and author from the case in force', () => {
    renderDialog(meta);

    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(meta.titulo);
    expect((screen.getByLabelText('Consigna') as HTMLInputElement).value).toBe(meta.consigna);
    expect((screen.getByLabelText('Autor') as HTMLInputElement).value).toBe(meta.autor);
  });

  it('opens with the focus on the title field (S63)', () => {
    renderDialog(meta);

    expect(document.activeElement).toBe(screen.getByLabelText('Título'));
  });

  it('shares the lab alone when the three fields are empty, and reports a null case', async () => {
    const onExported = vi.fn();
    const user = userEvent.setup();
    renderDialog(null, onExported);

    const decoded = decodeCase(linkField().value);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.data.meta).toBeNull();

    // The dialog reports what it shared so the panel above the canvas can appear (D32).
    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(onExported).toHaveBeenCalledWith(null);
  });
});

describe('ExportDialog: the link carries the whole case (S43, S50)', () => {
  it('builds a #c= link whose payload decodes back to the lab and the case', () => {
    renderDialog(meta);

    const link = linkField().value;
    expect(link).toContain('#c=');

    const decoded = decodeCase(link);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.data.meta).toEqual(meta);
    expect(decoded.data.lab.devices.map((device) => device.name)).toEqual(
      lab.devices.map((device) => device.name),
    );
    expect(decoded.data.lab.links).toHaveLength(lab.links.length);
  });

  it('uses the origin and path of the running app, never a hardcoded base', () => {
    renderDialog(meta);
    expect(linkField().value.startsWith(`${window.location.origin}${window.location.pathname}#c=`)).toBe(
      true,
    );
  });
});

describe('ExportDialog: copying tells the truth (S52)', () => {
  it('confirms the copy when the clipboard API resolves', async () => {
    // `userEvent.setup()` installs its own clipboard stub, so the fake goes on afterwards.
    const user = userEvent.setup();
    stubClipboard(() => Promise.resolve());
    const onExported = vi.fn();
    renderDialog(meta, onExported);

    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));

    await waitFor(() => expect(statusText()).toBe('Enlace copiado.'));
    expect(onExported).toHaveBeenCalledWith(meta);
  });

  it('confirms the copy when only the legacy path could copy (S52)', async () => {
    const user = userEvent.setup();
    stubClipboard(() => Promise.reject(new Error('denied')));
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    renderDialog(meta);

    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));

    await waitFor(() => expect(statusText()).toBe('Enlace copiado.'));
    // The legacy path really copied, so the stamp is the truth and not an assumption.
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('asks for Ctrl+C when neither path could copy, and leaves the link selected', async () => {
    const user = userEvent.setup();
    stubClipboard(() => Promise.reject(new Error('denied')));
    const execCommand = vi.fn(() => false);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    renderDialog(meta);

    const link = linkField();
    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));

    await waitFor(() =>
      expect(statusText()).toBe('No se pudo copiar solo. El enlace está seleccionado: pulsa Ctrl+C.'),
    );
    // Selecting is not copying: the legacy path ran and refused, so no success was claimed.
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(link.selectionStart).toBe(0);
    expect(link.selectionEnd).toBe(link.value.length);
  });
});

describe('ExportDialog: the stamp ages with the link (S52)', () => {
  it('drops the copy stamp as soon as a field changes', async () => {
    const user = userEvent.setup();
    stubClipboard(() => Promise.resolve());
    renderDialog(meta);

    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    await waitFor(() => expect(statusText()).toBe('Enlace copiado.'));

    // The link on screen is no longer the one in the clipboard, so the stamp has to go.
    await user.type(screen.getByLabelText('Título'), ' y algo más');

    expect(statusText()).toBe('');
  });

  it('shows no stamp when the dialog is reopened after a copy', async () => {
    const user = userEvent.setup();
    stubClipboard(() => Promise.resolve());
    const setOpen = renderOpenable(meta);

    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    await waitFor(() => expect(statusText()).toBe('Enlace copiado.'));

    setOpen(false);
    expect(screen.queryByRole('status')).toBeNull();
    setOpen(true);

    expect(statusText()).toBe('');
  });
});

describe('ExportDialog: reopening starts from the case in force (S49, D32)', () => {
  it('shows the case again after editing a field and reopening', async () => {
    const user = userEvent.setup();
    const setOpen = renderOpenable(meta);

    await user.clear(screen.getByLabelText('Título'));
    await user.type(screen.getByLabelText('Título'), 'Un borrador que no se guarda');
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(
      'Un borrador que no se guarda',
    );

    setOpen(false);
    setOpen(true);

    // The draft was never shared, so reopening shows the case in force and not the draft.
    expect((screen.getByLabelText('Título') as HTMLInputElement).value).toBe(meta.titulo);
    expect((screen.getByLabelText('Consigna') as HTMLInputElement).value).toBe(meta.consigna);
    expect((screen.getByLabelText('Autor') as HTMLInputElement).value).toBe(meta.autor);
  });
});

describe('ExportDialog: the .json download (S50)', () => {
  it('downloads the payload under netlab-<slug>-<stamp>.json and says so', async () => {
    const user = userEvent.setup();
    const onExported = vi.fn();
    renderDialog(meta, onExported);

    await user.click(screen.getByRole('button', { name: 'Descargar .json' }));

    expect(vi.mocked(downloadText)).toHaveBeenCalledTimes(1);
    const [fileName, text] = vi.mocked(downloadText).mock.calls[0];
    expect(fileName).toMatch(/^netlab-portatil-de-nuno-\d{4}-\d{2}-\d{2}\.json$/);
    // S50: the file is the indented JSON document, not the base64 code the link carries, so
    // it opens in an editor, can be corrected by hand and still goes back in (S53, S54).
    expect(text.startsWith('{\n  "v": 1,')).toBe(true);
    expect(text).toContain('\n  "lab": {');
    expect(JSON.parse(text)).toMatchObject({ v: 1 });
    expect(decodeCase(text).ok).toBe(true);
    expect(statusText()).toBe(`Descarga iniciada: ${fileName}`);
    expect(onExported).toHaveBeenCalledWith(meta);
  });
});

describe('ExportDialog: the header button and the panel it fills (S49, D32)', () => {
  it('opens the dialog and shows the shared case above the canvas', async () => {
    const user = userEvent.setup();
    stubClipboard(() => Promise.resolve());
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Compartir caso' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    await user.type(screen.getByLabelText('Título'), 'Mi caso');
    await user.click(screen.getByRole('button', { name: 'Copiar enlace' }));

    await waitFor(() => expect(statusText()).toBe('Enlace copiado.'));
    // The case the dialog reports back is stored and shown, which is what T5 was waiting for.
    expect(screen.getByRole('heading', { name: 'Mi caso' })).toBeTruthy();
  });
});

describe('ExportDialog: closing (S63)', () => {
  it('closes through onClose when the cancel event arrives (Escape)', () => {
    const onClose = vi.fn();
    renderDialog(meta, vi.fn(), onClose);

    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes through onClose from the Cerrar button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog(meta, vi.fn(), onClose);

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
