/**
 * The clipboard, told honestly (S52).
 *
 * `navigator.clipboard.writeText` is tried first. When there is no secure context or no
 * permission, the legacy `textarea` + `select()` + `document.execCommand('copy')` path runs.
 * Selecting the text on its own copies nothing: this function only answers `true` when the
 * browser said it copied, so the interface can tell the student the truth with Ctrl+C.
 */

/** True when the text really was copied; false in every other case, including a refusal. */
export async function copyText(text: string): Promise<boolean> {
  const api = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
  if (typeof api?.writeText === 'function') {
    try {
      await api.writeText(text);
      return true;
    } catch {
      // No secure context, no permission or a plain refusal: fall through to the legacy path.
    }
  }
  return copyWithExecCommand(text);
}

/**
 * The legacy path: an off-screen `textarea`, selected and copied through `execCommand`.
 * Returns whatever the browser answered — never `true` because the text was selected.
 */
function copyWithExecCommand(text: string): boolean {
  if (typeof document === 'undefined') return false;

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  // Off-screen but still selectable: a hidden field cannot be copied from.
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.left = '-9999px';
  area.style.opacity = '0';

  document.body.appendChild(area);
  try {
    area.select();
    if (typeof document.execCommand !== 'function') return false;
    return document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
