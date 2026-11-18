import { useEffect, useRef, useState } from 'react';
import { decodeCase, type CaseData, type CaseFailure } from '../../domain/case';
import type { Lab } from '../../domain/lab';
import { useI18n } from '../../i18n/LanguageProvider';
import type { MessageKey, MessageParams } from '../../i18n/types';
import { caseFailureText } from '../caseMessage';
import { needsReplaceConfirmation } from '../labComparison';

/** A file bigger than this is refused before it is read (S54). */
export const MAX_IMPORT_FILE_BYTES = 65_536;

/** What the analyser accepts: the exported document, or a `.txt` with the link inside (S54). */
const ACCEPTED_FILES = '.json,.txt,application/json,text/plain';

export interface ImportDialogProps {
  open: boolean;
  /** The lab on screen: only used to decide whether replacing it needs confirmation (S55). */
  lab: Lab;
  onClose: () => void;
  /** Called once with a decoded case: the parent replaces the lab and stores the case (S56). */
  onImport: (data: CaseData) => void;
}

/** Why the last attempt did not import: a `decodeCase` failure, or a field with nothing in it. */
type Problem = { kind: 'failure'; failure: CaseFailure } | { kind: 'empty' };

/** The case just imported, as the title the status line shows; `null` title means untitled. */
type Imported = { title: string | null };

/**
 * The import dialog (S53–S57, S63): one field for the four accepted forms, a file, a
 * confirmation when there is work to lose, and the six failures in plain language.
 *
 * Built on the native `<dialog>` exactly like `ExportDialog`: `showModal()` when the element
 * has it — focus trap, Escape and `::backdrop` come from the browser — and the `open`
 * attribute as the fallback for a DOM that does not implement it (jsdom).
 *
 * `decodeCase` is the only entry point and nothing here throws: a rejected import shows its
 * failure through the catalogue and leaves the lab on screen untouched (S57). The dialog
 * stays open after an import so the result can be read; the parent owns closing it.
 */
export function ImportDialog({ open, lab, onClose, onImport }: ImportDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  /** The file chosen or dropped, pending until `Abrir` reads it (S54). */
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [imported, setImported] = useState<Imported | null>(null);
  /** True while `File.text()` is in flight: a second click must not start a second import. */
  const [reading, setReading] = useState(false);
  const readingRef = useRef(false);
  /**
   * Every opening is a new visit, and so is every closing: a read still in flight when its
   * visit ends is about a dialog that no longer exists, and nothing of it applies (S54).
   */
  const visitRef = useRef(0);

  /**
   * The hidden `<input type="file">` keeps its last choice and fires no `change` for the same
   * path again, so it is cleared whenever the file stops being the source (S54).
   */
  function clearFileChoice(): void {
    if (fileRef.current !== null) fileRef.current.value = '';
  }

  /** Nothing of the previous visit is about this one: a rejected file must not survive (S54). */
  function reset(): void {
    setText('');
    setFile(null);
    setProblem(null);
    setImported(null);
    // A read of the previous visit is stale: it must not keep Abrir disabled either (S54).
    readingRef.current = false;
    setReading(false);
    clearFileChoice();
  }

  // The modal itself: `showModal()` when the element has it, the attribute when it does not.
  // The component renders nothing while closed, so nothing of it is ever on screen.
  useEffect(() => {
    // The visit ends here, whatever comes next: a read still in flight dies with the token.
    visitRef.current += 1;
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog === null) return;

    reset();

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    fieldRef.current?.focus();
  }, [open]);

  /** One source at a time: pasting text drops the file, and a file drops the pasted text. */
  function typeInto(value: string): void {
    setText(value);
    setFile(null);
    setProblem(null);
    setImported(null);
    clearFileChoice();
  }

  function acceptFile(picked: File): void {
    setText('');
    setFile(picked);
    setProblem(null);
    setImported(null);
  }

  /** Reads what the student gave: the file first, the field otherwise (S53, S54). */
  async function submit(): Promise<void> {
    // Two clicks while a read is pending would import twice: the first one wins (S56).
    if (readingRef.current) return;
    setProblem(null);
    setImported(null);

    if (file !== null) {
      // Measured before `File.text()`, which is asynchronous: there is no reason to read
      // 40 MB to find out it does not fit (S54). `decodeCase` still enforces the real cap.
      if (file.size > MAX_IMPORT_FILE_BYTES) {
        setProblem({ kind: 'failure', failure: tooLarge(file.size) });
        return;
      }
      readingRef.current = true;
      setReading(true);
      // The visit this read belongs to: if the dialog closes and reopens, it is stale (S54).
      const visit = visitRef.current;
      let content: string | null = null;
      try {
        content = await file.text();
      } catch {
        // A file the browser refuses to read is text this analyser cannot understand.
        content = null;
      } finally {
        // Another visit may have started while the file was being read: its state is not ours.
        if (visit === visitRef.current) {
          readingRef.current = false;
          setReading(false);
        }
      }
      // The file was consumed, whatever the answer: the same path has to be pickable again.
      clearFileChoice();
      // The visit ended while the file was being read: this is a dialog that is not this one.
      if (visit !== visitRef.current) return;
      if (content === null) {
        setProblem({ kind: 'failure', failure: { code: 'formato-invalido' } });
        return;
      }
      // A file is the same string a paste is, so it is trimmed the same way (S53, S54).
      apply(content.trim());
      return;
    }

    const pasted = text.trim();
    // Nothing to analyse is not a broken case: it is a field waiting to be filled.
    if (pasted === '') {
      setProblem({ kind: 'empty' });
      return;
    }
    apply(pasted);
  }

  /** Decodes, confirms when there is work to lose, and reports the case to the parent (S55, S56). */
  function apply(content: string): void {
    const decoded = decodeCase(content);
    if (!decoded.ok) {
      setProblem({ kind: 'failure', failure: decoded.failure });
      return;
    }
    if (needsReplaceConfirmation(lab) && !window.confirm(t('import.confirmReplace'))) return;

    onImport(decoded.data);
    setText('');
    setFile(null);
    // An `<input type="file">` keeps its last choice, so the same file can be picked again.
    clearFileChoice();
    const title = decoded.data.meta?.titulo ?? '';
    setImported({ title: title.trim() === '' ? null : title });
  }

  if (!open) return null;

  // The dialog is named by its title, and by the drop hint while a file hovers it, so the
  // state is announced and not only painted (S63).
  const message =
    imported === null
      ? (file?.name ?? '')
      : t('import.done', { title: imported.title ?? t('case.untitled') });

  // The accessible name of a dialog is its title, never a paragraph: a screen reader would read
  // the whole hint as the name. The drop state is decoration and does not rename anything.
  return (
    <dialog
      ref={dialogRef}
      className={dragging ? 'dialog dialog__drop dialog__drop--active' : 'dialog dialog__drop'}
      aria-labelledby="import-dialog-title"
      onCancel={(event) => {
        // Escape closes through the same door as the button, so the parent owns the state.
        event.preventDefault();
        onClose();
      }}
      onDragOver={(event) => {
        // Without this the browser never treats the dialog as a drop target (S54).
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        // Moving between the children of the dialog is not leaving it.
        const next = event.relatedTarget as Node | null;
        if (next === null || !event.currentTarget.contains(next)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const picked = event.dataTransfer?.files?.[0];
        // The same path as the file button: one analyser for both doors (S54).
        if (picked !== undefined) acceptFile(picked);
      }}
    >
      <h2 className="dialog__title" id="import-dialog-title">
        {t('import.title')}
      </h2>
      <p className="dialog__hint">{t('import.hint')}</p>

      <label className="field" htmlFor="import-field">
        <span className="field__label">{t('import.fieldLabel')}</span>
        <textarea
          id="import-field"
          ref={fieldRef}
          className="field__input dialog__link"
          rows={4}
          value={text}
          onChange={(event) => typeInto(event.target.value)}
        />
      </label>

      {/* The button is the visible door; this input is the one the browser can open. Its
          `value` is cleared whenever the file stops being the source, so the same path can be
          chosen again and fires `change` (S54). */}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_FILES}
        hidden
        onChange={(event) => {
          const picked = event.target.files?.[0];
          // The same path as a drop: one analyser for both doors (S54).
          if (picked !== undefined) acceptFile(picked);
        }}
      />

      {problem === null ? null : (
        <p className="dialog__error" role="alert">
          {problemText(t, problem)}
        </p>
      )}

      <div className="dialog__actions">
        <button
          type="button"
          className="button"
          disabled={reading}
          onClick={() => void submit()}
        >
          {t('import.action')}
        </button>
        <button type="button" className="button" onClick={() => fileRef.current?.click()}>
          {t('import.chooseFile')}
        </button>
        <button type="button" className="button" onClick={onClose}>
          {t('dialog.close')}
        </button>
      </div>

      <p className="dialog__status" role="status">
        {message}
      </p>
    </dialog>
  );
}

/** The bound `t` of the provider, so the helper below cannot reach another language. */
type Translate = (key: MessageKey, params?: MessageParams) => string;

/** The size guard of S54 in the failure shape the catalogue already knows. */
function tooLarge(n: number): CaseFailure {
  return { code: 'payload-demasiado-grande', params: { n, max: MAX_IMPORT_FILE_BYTES } };
}

/** The failure in the language on screen, never a raw message or a field path of our own (S57). */
function problemText(t: Translate, problem: Problem): string {
  if (problem.kind === 'empty') return t('import.empty');
  return caseFailureText(t, problem.failure);
}
