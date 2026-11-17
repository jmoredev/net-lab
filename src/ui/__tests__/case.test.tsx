// @vitest-environment jsdom
import { cleanup, render, renderHook, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CaseMeta } from '../../domain/case';
import { LanguageProvider } from '../../i18n/LanguageProvider';
import { CASE_STORAGE_KEY, parseCase } from '../caseStorage';
import { CasePanel } from '../components/CasePanel';
import { useStoredCase } from '../useStoredCase';

const meta: CaseMeta = {
  titulo: 'La red no reparte direcciones',
  consigna: 'El portátil de Ana no llega a internet. Averigua por qué y arréglalo.',
  autor: 'Pareja 7 — Ana y Luis',
};

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('useStoredCase: the case survives a reload (D32)', () => {
  it('starts empty and persists what it is given', () => {
    const { result } = renderHook(() => useStoredCase());
    expect(result.current[0]).toBeNull();

    act(() => result.current[1](meta));

    expect(result.current[0]).toEqual(meta);
    expect(parseCase(window.localStorage.getItem(CASE_STORAGE_KEY))).toEqual(meta);
  });

  it('starts from the stored case and forgets it when set to null', () => {
    const first = renderHook(() => useStoredCase());
    act(() => first.result.current[1](meta));

    const second = renderHook(() => useStoredCase());
    expect(second.result.current[0]).toEqual(meta);

    act(() => second.result.current[1](null));
    expect(window.localStorage.getItem(CASE_STORAGE_KEY)).toBeNull();
  });

  it('does not touch the lab key', () => {
    const { result } = renderHook(() => useStoredCase());
    act(() => result.current[1](meta));

    expect(window.localStorage.getItem('net-lab:lab:v1')).toBeNull();
  });
});

describe('CasePanel: the brief is user data, shown as text (S45, S62)', () => {
  const renderPanel = (value: CaseMeta) =>
    render(
      <LanguageProvider>
        <CasePanel meta={value} />
      </LanguageProvider>,
    );

  it('shows title, consigna and author', () => {
    renderPanel(meta);

    expect(screen.getByRole('heading', { name: meta.titulo })).toBeTruthy();
    expect(screen.getByText(meta.consigna)).toBeTruthy();
    expect(screen.getByText('Por Pareja 7 — Ana y Luis')).toBeTruthy();
  });

  it('says so when the case has no title and drops the empty lines', () => {
    const { container } = renderPanel({ titulo: '', consigna: '', autor: '' });

    expect(screen.getByRole('heading', { name: 'Caso sin título' })).toBeTruthy();
    expect(container.querySelector('.case__brief')).toBeNull();
    expect(container.querySelector('.case__author')).toBeNull();
  });

  it('renders a consigna that looks like markup as plain text', () => {
    const consigna = '<b>arréglalo</b> & mira';
    renderPanel({ titulo: 'T', consigna, autor: 'A' });

    expect(screen.getByText(consigna)).toBeTruthy();
  });
});
