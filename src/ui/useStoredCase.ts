import { useEffect, useState } from 'react';
import type { CaseMeta } from '../domain/case';
import { clearCase, loadCase, saveCase } from './caseStorage';

/**
 * The case of the lab on screen, persisted under its own key (D32). It is deliberately not part
 * of `labReducer`: the lab is what the student edits, the case is what the teacher sent, and a
 * reload has to keep both.
 */
export function useStoredCase(): [CaseMeta | null, (meta: CaseMeta | null) => void] {
  const [meta, setMeta] = useState<CaseMeta | null>(() => loadCase());

  useEffect(() => {
    if (meta === null) clearCase();
    else saveCase(meta);
  }, [meta]);

  return [meta, setMeta];
}
