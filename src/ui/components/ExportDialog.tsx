import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_CASE_AUTHOR,
  MAX_CASE_BRIEF,
  MAX_CASE_TITLE,
  encodeCase,
  type CaseFailure,
  type CaseMeta,
} from '../../domain/case';
import type { Lab } from '../../domain/lab';
import { useI18n } from '../../i18n/LanguageProvider';
import type { MessageKey, MessageParams } from '../../i18n/types';
import { caseFileName, caseLink } from '../caseLink';
import { copyText } from '../clipboard';
import { downloadText } from '../download';

export interface ExportDialogProps {
  open: boolean;
  lab: Lab;
  initialMeta: CaseMeta | null;
  onClose: () => void;
  /** Called with the case actually shared, or `null` when the three fields were empty. */
  onExported: (meta: CaseMeta | null) => void;
}

/** The three fields start empty and are replaced by the case in force when the dialog opens. */
const EMPTY_META: CaseMeta = { titulo: '', consigna: '', autor: '' };

const MIME_JSON = 'application/json';

/** What the last action did, so the status line can say it and a screen reader can read it. */
type Status = { kind: 'copied' } | { kind: 'manual' } | { kind: 'downloaded'; file: string };

/**
 * The export dialog (S49–S52, S63): the case of the lab on screen, as a link or as a file.
 *
 * Built on the native `<dialog>` with no library and no portal. `showModal()` is used when it
 * exists — focus trap, Escape and `::backdrop` come from the browser — and the `open`
 * attribute is the fallback for a DOM that does not implement it (jsdom, older engines).
 *
 * Nothing here throws: an `encodeCase` failure disables both actions and shows the reason
 * through the catalogue, and the link stays visible so a student can always copy it by hand
 * when the clipboard refuses (S52).
 */
export function ExportDialog({ open, lab, initialMeta, onClose, onExported }: ExportDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLTextAreaElement>(null);
  const [fields, setFields] = useState<CaseMeta>(() => initialMeta ?? EMPTY_META);
  const [status, setStatus] = useState<Status | null>(null);

  // The modal itself: `showModal()` when the element has it, the attribute when it does not.
  // The component renders nothing while closed, so the brief of a closed dialog is never on
  // screen — not in a browser and not in a DOM that has no user-agent stylesheet.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    titleRef.current?.focus();
  }, [open]);

  /** The case as the payload will carry it: three empty fields mean no case at all (S51). */
  const meta: CaseMeta | null = hasContent(fields) ? fields : null;
  const encoded = useMemo(() => encodeCase({ meta, lab }), [meta, lab]);

  // Same origin and path the app is served from, never a hardcoded base (S43, S50).
  const base = useMemo<{ origin: string; pathname: string }>(
    () =>
      typeof window === 'undefined'
        ? { origin: '', pathname: '' }
        : { origin: window.location.origin, pathname: window.location.pathname },
    [],
  );
  const link = encoded.ok ? caseLink(encoded.payload, base.origin, base.pathname) : '';

  async function copy(): Promise<void> {
    if (!encoded.ok) return;
    // The case is shared as soon as the student asks for it, even if the clipboard refuses:
    // the text is on screen and the panel above the canvas is what D32 promises (S49).
    onExported(meta);
    if (await copyText(link)) {
      setStatus({ kind: 'copied' });
      return;
    }
    // Selecting copies nothing: the text stays selected and the message says Ctrl+C (S52).
    linkRef.current?.select();
    setStatus({ kind: 'manual' });
  }

  function download(): void {
    if (!encoded.ok) return;
    onExported(meta);
    // The file carries the same string the link does, so one analyser opens both (S53, S54).
    const file = caseFileName(meta?.titulo ?? '', new Date());
    downloadText(file, encoded.json, MIME_JSON);
    setStatus({ kind: 'downloaded', file });
  }

  // An encoding failure wins over any earlier message: it is why both actions are disabled.
  const message = encoded.ok ? statusText(t, status) : failureText(t, encoded.failure);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="export-dialog-title"
      onCancel={(event) => {
        // Escape closes through the same door as the button, so the parent owns the state.
        event.preventDefault();
        onClose();
      }}
    >
      <h2 className="dialog__title" id="export-dialog-title">
        {t('export.title')}
      </h2>
      <p className="dialog__hint">{t('export.hint')}</p>

      <div className="dialog__fields">
        <label className="field" htmlFor="export-field-title">
          <span className="field__label">{t('export.fieldTitle')}</span>
          <input
            id="export-field-title"
            ref={titleRef}
            className="field__input"
            type="text"
            maxLength={MAX_CASE_TITLE}
            value={fields.titulo}
            onChange={(event) => setFields({ ...fields, titulo: event.target.value })}
          />
        </label>

        <label className="field" htmlFor="export-field-brief">
          <span className="field__label">{t('export.fieldBrief')}</span>
          <input
            id="export-field-brief"
            className="field__input"
            type="text"
            maxLength={MAX_CASE_BRIEF}
            value={fields.consigna}
            onChange={(event) => setFields({ ...fields, consigna: event.target.value })}
          />
        </label>

        <label className="field" htmlFor="export-field-author">
          <span className="field__label">{t('export.fieldAuthor')}</span>
          <input
            id="export-field-author"
            className="field__input"
            type="text"
            maxLength={MAX_CASE_AUTHOR}
            value={fields.autor}
            onChange={(event) => setFields({ ...fields, autor: event.target.value })}
          />
        </label>
      </div>

      <label className="field" htmlFor="export-link">
        <span className="field__label">{t('export.linkLabel')}</span>
        <textarea
          id="export-link"
          ref={linkRef}
          className="field__input dialog__link"
          readOnly
          rows={3}
          value={link}
        />
      </label>

      <div className="dialog__actions">
        <button type="button" className="button" disabled={!encoded.ok} onClick={() => void copy()}>
          {t('export.actionCopy')}
        </button>
        <button type="button" className="button" disabled={!encoded.ok} onClick={download}>
          {t('export.actionDownload')}
        </button>
        <button type="button" className="button" onClick={onClose}>
          {t('export.close')}
        </button>
      </div>

      <p
        className={encoded.ok ? 'dialog__status' : 'dialog__status dialog__status--error'}
        role="status"
      >
        {message}
      </p>
    </dialog>
  );
}

/** The bound `t` of the provider, so the helpers below cannot reach another language. */
type Translate = (key: MessageKey, params?: MessageParams) => string;

/** A whitespace-only field says nothing, exactly like an empty one. */
function hasContent(meta: CaseMeta): boolean {
  return meta.titulo.trim() !== '' || meta.consigna.trim() !== '' || meta.autor.trim() !== '';
}

/** The failure of `encodeCase` in the language on screen, never a raw message (S57). */
function failureText(t: Translate, { code, params, detail }: CaseFailure): string {
  if (detail === undefined) return t(code, params);
  // A cable failure reuses the sentence the domain already knows how to say (S57, D33), so the
  // student reads exactly what they would get by trying that cable in the app.
  return t(code, { ...params, detalle: t(detail.code, detail.params) });
}

function statusText(t: Translate, status: Status | null): string {
  if (status === null) return '';
  if (status.kind === 'copied') return t('export.copied');
  if (status.kind === 'manual') return t('export.copyManual');
  return t('export.downloaded', { file: status.file });
}
