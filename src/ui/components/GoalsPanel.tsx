import { useEffect, useRef } from 'react';
import type { Lab } from '../../domain/lab';
import { evaluateGoals, isLevelComplete, type Goal, type Level } from '../../domain/levels';
import { useI18n } from '../../i18n/LanguageProvider';
import type { MessageKey, MessageParams } from '../../i18n/types';
import { levelTextKey } from './LevelsDialog';

/**
 * The catalogue sentence of one goal, with the name the device has right now (S69, S73).
 *
 * Every kind resolves its own template: the two connectivity goals and the exact address
 * name a device, the router goal names a network and its range, and the naming goal says the
 * current name and the one the level asks for. A goal whose device is gone falls back to the
 * unknown-device word, so a broken level reads as a sentence and never as a crash.
 */
function goalSentence(
  t: (key: MessageKey, params?: MessageParams) => string,
  goal: Goal,
  currentName: string,
): string {
  switch (goal.kind) {
    case 'online':
      return t('levels.goalOnline', { name: currentName });
    case 'manual-online':
      return t('levels.goalManualOnline', { name: currentName });
    case 'address-is':
      return t('levels.goalAddressIs', { name: currentName, ip: goal.ip, gateway: goal.gateway });
    case 'router-network':
      return t('levels.goalRouterNetwork', {
        ip: goal.lanIp,
        start: goal.dhcpStart,
        end: goal.dhcpEnd,
      });
    case 'device-named':
      return t('levels.goalDeviceNamed', { name: currentName, target: goal.name });
  }
}

export interface GoalsPanelProps {
  level: Level;
  /** The lab on screen: every render answers the goals against it, never against a cache (S69). */
  lab: Lab;
  /** How to enter the next level, or `null` on the last one, which offers going back (S69). */
  onNext: (() => void) | null;
  onBackToLevels: () => void;
  /** Called once per visit when every goal is met, so the parent stores the completion (S69). */
  onCompleted: (levelId: string) => void;
}

/**
 * The live goals panel (S69): the consigna of the active level, one line per goal with the
 * name the device has right now, and the banner of a level well done.
 *
 * The goals are derived from the lab of the moment on every render, which is what makes the
 * panel live: a cable, a manual address or a WiFi association changes the answer, and nothing
 * stale survives a change. The completion is reported once per visit — the ref below is the
 * guard, so a re-render of an already completed level saves nothing.
 *
 * Leaving the level never touches the lab: both actions are navigation, and the editor below
 * stays exactly as the student left it (S70).
 */
export function GoalsPanel({ level, lab, onNext, onBackToLevels, onCompleted }: GoalsPanelProps) {
  const { t } = useI18n();
  const states = evaluateGoals(lab, level.goals);
  const complete = isLevelComplete(states);
  /** The level already reported as completed in this visit: a re-render does not report it twice. */
  const reported = useRef<string | null>(null);

  useEffect(() => {
    if (!complete || reported.current === level.id) return;
    reported.current = level.id;
    onCompleted(level.id);
  }, [complete, level.id, onCompleted]);

  return (
    <section className="goals" aria-label={t('levels.panelTitle')}>
      <h2 className="goals__title">{t(levelTextKey(level.id, 'title'))}</h2>
      <p className="goals__brief">{t(levelTextKey(level.id, 'brief'))}</p>

      <h3 className="goals__subtitle">{t('levels.panelTitle')}</h3>
      <ul className="goals__list">
        {states.map((state, index) => {
          // The name is the one the lab shows now: renaming a device renames the goal (S69).
          // The router goal is about the lab, so it has no device and no name to resolve.
          const deviceId = 'deviceId' in state.goal ? state.goal.deviceId : null;
          const device =
            deviceId === null ? undefined : lab.devices.find((candidate) => candidate.id === deviceId);
          const name = device?.name ?? t('canvas.unknownDevice');
          const sentence = goalSentence(t, state.goal, name);
          const stateWord = t(state.met ? 'levels.goalMet' : 'levels.goalPending');
          return (
            <li
              // The goals are data with a fixed order: the index is their identity in the list.
              key={index}
              className={`goals__item goals__item--${state.met ? 'met' : 'pending'}`}
              // The colour is the student's state; this attribute is the same answer for CSS
              // and for the tests, which never have to read a style to know a goal is met.
              data-met={state.met ? 'true' : 'false'}
              // Green or red is invisible to a screen reader, so the line announces the state
              // as a word too, like the WiFi marks of the canvas carry theirs (S34, S69).
              // The visible line is unchanged: the state word lives only in the name.
              aria-label={`${sentence} — ${stateWord}`}
            >
              {sentence}
            </li>
          );
        })}
      </ul>

      {complete ? (
        <>
          <p className="goals__banner" role="status">
            {t('levels.done')}
          </p>
          <div className="goals__actions">
            {onNext === null ? (
              <>
                <p className="goals__finished">{t('levels.finishedAll')}</p>
                <button type="button" className="button" onClick={onBackToLevels}>
                  {t('levels.backToLevels')}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="button" onClick={onNext}>
                  {t('levels.next')}
                </button>
                <button type="button" className="button" onClick={onBackToLevels}>
                  {t('levels.backToLevels')}
                </button>
              </>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
