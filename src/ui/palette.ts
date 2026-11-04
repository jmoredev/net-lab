import type { DeviceKind } from '../domain/types';

/**
 * Addable kinds, in the order the palette shows them (S6, S7, D1). Lives outside the
 * component module so Fast Refresh keeps working: a component module exports components only.
 */
export const PALETTE_KINDS: readonly DeviceKind[] = ['router', 'switch', 'laptop', 'desktop', 'phone'];

/** Drag payload used between the palette and the canvas. */
export const PALETTE_MIME = 'application/x-net-lab-kind';
