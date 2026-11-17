import { describe, expect, it, vi } from 'vitest';
import { encodeCase } from '../../domain/case';
import { createExampleLab } from '../../domain/example';
import { clearFragment, readCaseFromHash } from '../startup';

const payload = (): string => {
  const encoded = encodeCase({
    meta: { titulo: 'La red no reparte direcciones', consigna: 'Averigua por qué.', autor: 'Pareja 7' },
    lab: createExampleLab(),
  });
  if (!encoded.ok) throw new Error('expected the example lab to encode');
  return encoded.payload;
};

describe('startup: a link that carries a case (S58)', () => {
  it('reads no case out of a plain URL', () => {
    expect(readCaseFromHash('')).toBeNull();
    expect(readCaseFromHash('#top')).toBeNull();
  });

  it('reads the case, brief included, out of #c=', () => {
    const startup = readCaseFromHash(`#c=${payload()}`);

    expect(startup?.failure).toBeNull();
    expect(startup?.data?.meta?.titulo).toBe('La red no reparte direcciones');
    expect(startup?.data?.lab.devices).toHaveLength(createExampleLab().devices.length);
  });

  it('reports the failure instead of throwing on a broken fragment', () => {
    const startup = readCaseFromHash('#c=not-a-case');

    expect(startup?.data).toBeNull();
    expect(startup?.failure?.code).toBe('formato-invalido');
  });

  it('reports a payload of another version', () => {
    const json = JSON.stringify({ v: 2, lab: { dispositivos: [], cables: [] } });
    const startup = readCaseFromHash(`#c=${json}`);

    expect(startup?.failure?.code).toBe('version-no-soportada');
  });
});

describe('startup: the fragment is cleared without a history entry (S58, D-g)', () => {
  it('rewrites the URL to path and query only', () => {
    const replaceState = vi.fn();

    clearFragment({ replaceState }, { pathname: '/net-lab/', search: '?x=1' });

    expect(replaceState).toHaveBeenCalledWith(null, '', '/net-lab/?x=1');
  });
});
