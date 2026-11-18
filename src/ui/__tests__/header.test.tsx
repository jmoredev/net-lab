// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { ES } from '../../i18n/es';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

/**
 * The header writes files and changes the lab; the two things do not belong to the same
 * gesture. Each side is its own named group, so "Vaciar laboratorio" never sits in the
 * row that saves a case.
 */
describe('header: the lab and the case file are two groups', () => {
  it('keeps every lab action in its own group', () => {
    render(<App />);

    const lab = screen.getByRole('group', { name: ES['header.labGroup'] });

    expect(within(lab).getByRole('button', { name: ES['header.loadExample'] })).not.toBeNull();
    expect(within(lab).getByRole('button', { name: ES['header.clearLab'] })).not.toBeNull();
    expect(within(lab).queryByRole('button', { name: ES['header.importCase'] })).toBeNull();
    expect(within(lab).queryByRole('button', { name: ES['header.shareCase'] })).toBeNull();
  });

  it('keeps the case file in its own group, read from open to share', () => {
    render(<App />);

    const file = screen.getByRole('group', { name: ES['header.caseGroup'] });

    expect(within(file).queryByRole('button', { name: ES['header.loadExample'] })).toBeNull();
    expect(within(file).queryByRole('button', { name: ES['header.clearLab'] })).toBeNull();
    expect(within(file).getAllByRole('button').map((button) => button.textContent)).toEqual([
      ES['header.importCase'],
      ES['header.shareCase'],
    ]);
  });

  it('keeps the «Desafíos» entry in the lab group, not among the case files', () => {
    render(<App />);

    const lab = screen.getByRole('group', { name: ES['header.labGroup'] });
    const file = screen.getByRole('group', { name: ES['header.caseGroup'] });

    expect(within(lab).getByRole('button', { name: ES['levels.action'] })).not.toBeNull();
    expect(within(file).queryByRole('button', { name: ES['levels.action'] })).toBeNull();
  });

  it('reads the lab first, the file second, and leaves the language outside both', () => {
    render(<App />);

    const header = screen.getByRole('banner');
    const groups = within(header)
      .getAllByRole('group')
      .map((group) => group.getAttribute('aria-label'));

    expect(groups).toEqual([
      ES['header.labGroup'],
      ES['header.caseGroup'],
      ES['lang.switcher'],
    ]);
  });
});
