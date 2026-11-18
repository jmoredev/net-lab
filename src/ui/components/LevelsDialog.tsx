import { useEffect, useRef } from 'react';
import type { Lab } from '../../domain/lab';
import { LEVELS, type Level, type LevelDifficulty } from '../../domain/levels';
import { useI18n } from '../../i18n/LanguageProvider';
import type { UiKey } from '../../i18n/types';
import { needsReplaceConfirmation } from '../labComparison';
import type { LevelProgress } from '../levelProgress';

export interface LevelsDialogProps {
  open: boolean;
  /** The lab on screen: only used to decide whether entering has to ask first (S68). */
  lab: Lab;
  /** `superados` and `ultimo`, the two marks a card carries (S66). */
  progress: LevelProgress;
  onClose: () => void;
  /** Called with the level the student chose: the parent loads it and remembers it (S68). */
  onEnter: (level: Level) => void;
}

/**
 * The catalogue key of a level's title or brief (S71). The id comes from the level data, so
 * the key cannot be a literal here: this is the single seam between `LEVELS` and the
 * dictionaries, and both catalogues carry all ten ids.
 */
export function levelTextKey(id: string, part: 'title' | 'brief'): UiKey {
  return `levels.${id}.${part}` as UiKey;
}

/**
 * The catalogue word of a declared difficulty (S75). The badge always writes it: the colour
 * is reinforcement for the eye, never the only channel, so a screen reader gets the tier too.
 */
export function difficultyTextKey(difficulty: LevelDifficulty): UiKey {
  switch (difficulty) {
    case 'easy':
      return 'levels.difficultyEasy';
    case 'medium':
      return 'levels.difficultyMedium';
    case 'hard':
      return 'levels.difficultyHard';
  }
}

/**
 * The classes of the difficulty badge: one shared block for the selector and the panel, and
 * one modifier per tier that only changes the colour. Both consumers render the same badge,
 * so the word, the shape and the three colours cannot drift apart between them.
 */
export function difficultyBadgeClass(difficulty: LevelDifficulty): string {
  return `difficulty-badge difficulty-badge--${difficulty}`;
}

/**
 * The level selector (S67, S68): the ten levels of S72 and S74 as a grid ordered by `order`,
 * with the difficulty each level declares (S75), the completed badge and the «seguir por aquí»
 * mark of the stored progress, and no lock of any kind — the order is a suggestion, never a
 * requirement.
 *
 * Built on the native `<dialog>` exactly like `ImportDialog` and `ExportDialog`: `showModal()`
 * when the element has it and the `open` attribute as the fallback for a DOM that does not
 * implement it (jsdom). Escape closes through the same door as the button, so the parent owns
 * every state change.
 *
 * Entering a level replaces the lab on screen, so the rule of S55 applies unchanged: with
 * work of the student's own to lose, the dialog asks first and a decline keeps the selector
 * open with nothing loaded (S68).
 */
export function LevelsDialog({ open, lab, progress, onClose, onEnter }: LevelsDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstCardRef = useRef<HTMLButtonElement>(null);

  // The modal itself: `showModal()` when the element has it, the attribute when it does not.
  // The component renders nothing while closed, so nothing of it is ever on screen.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    firstCardRef.current?.focus();
  }, [open]);

  if (!open) return null;

  // `order` is a visual suggestion (S67), so it decides the grid and nothing else. The data
  // is copied before sorting: `LEVELS` is shared with the rest of the app.
  const levels = [...LEVELS].sort((a, b) => a.order - b.order);

  /** Enters a level, asking first when that would throw away work of the student's own (S68). */
  function enter(level: Level): void {
    if (needsReplaceConfirmation(lab) && !window.confirm(t('import.confirmReplace'))) return;
    onEnter(level);
  }

  return (
    <dialog
      ref={dialogRef}
      className="dialog dialog--levels"
      aria-labelledby="levels-dialog-title"
      onCancel={(event) => {
        // Escape closes through the same door as the button, so the parent owns the state.
        event.preventDefault();
        onClose();
      }}
    >
      <h2 className="dialog__title" id="levels-dialog-title">
        {t('levels.selectorTitle')}
      </h2>
      <p className="dialog__hint">{t('levels.selectorHint')}</p>

      <ul className="levels">
        {levels.map((level, index) => {
          const completed = progress.superados.includes(level.id);
          // The last level opened, wherever it is in the suggested order (S66).
          const resume = progress.ultimo === level.id;
          return (
            <li key={level.id} className="levels__item">
              <button
                type="button"
                className="level-card"
                ref={index === 0 ? firstCardRef : undefined}
                onClick={() => enter(level)}
              >
                <span className="level-card__order">{level.order}</span>
                <span className="level-card__title">{t(levelTextKey(level.id, 'title'))}</span>
                <span className={difficultyBadgeClass(level.difficulty)}>
                  {t(difficultyTextKey(level.difficulty))}
                </span>
                {completed ? (
                  <span className="level-card__badge">{t('levels.completedBadge')}</span>
                ) : null}
                {resume ? <span className="level-card__resume">{t('levels.resume')}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="dialog__actions">
        <button type="button" className="button" onClick={onClose}>
          {t('dialog.close')}
        </button>
      </div>
    </dialog>
  );
}
