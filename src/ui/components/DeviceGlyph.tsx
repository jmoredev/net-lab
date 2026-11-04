import type { ReactNode } from 'react';
import type { DeviceKind } from '../../domain/types';

export interface DeviceGlyphProps {
  kind: DeviceKind;
  /** Rendered size in pixels; the icon is square and draws with `currentColor` (S8). */
  size?: number;
}

const DRAWINGS: Record<DeviceKind, ReactNode> = {
  router: (
    <>
      <rect x="2.5" y="9.5" width="19" height="8.5" rx="2" />
      <path d="M7 9.5V5.5M17 9.5V5.5" />
      <path d="M6.5 14.2h1.6M10.2 14.2h1.6M13.9 14.2h1.6" />
      <path d="M7 4.2v1.3M17 4.2v1.3" />
    </>
  ),
  switch: (
    <>
      <rect x="2.5" y="9" width="19" height="7.5" rx="1.5" />
      <path d="M6 13.2h1.8M9.6 13.2H11.4M13.2 13.2h1.8M16.8 13.2h1.8" />
      <path d="M6.9 10.6h.01M17.1 10.6h.01" />
    </>
  ),
  laptop: (
    <>
      <rect x="4.5" y="4.5" width="15" height="10.5" rx="1.5" />
      <path d="M2.5 18.5h19l-1.8-3.5H4.3z" />
    </>
  ),
  desktop: (
    <>
      <rect x="2.5" y="4.5" width="19" height="11" rx="1.5" />
      <path d="M9 19.5h6M12 15.5v4" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.6 5.2h2.8" />
      <path d="M11.2 18.6h1.6" />
    </>
  ),
  internet: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <ellipse cx="12" cy="12" rx="4.2" ry="9" />
    </>
  ),
};

/** Inline SVG icon per device kind; no external assets, no images to download (S8). */
export function DeviceGlyph({ kind, size = 40 }: DeviceGlyphProps) {
  return (
    <svg
      className="glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DRAWINGS[kind]}
    </svg>
  );
}
