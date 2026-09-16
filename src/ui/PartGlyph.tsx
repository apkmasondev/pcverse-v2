import type { ReactNode } from 'react';
import type { PartId } from '../atlas/content';

const paths: Record<PartId, ReactNode> = {
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="1" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" />
    </>
  ),
  gpu: (
    <>
      <rect x="2.5" y="6" width="19" height="10" rx="1" />
      <circle cx="8" cy="11" r="3" />
      <circle cx="16" cy="11" r="3" />
      <path d="M5 16v3h9v-3M2.5 9H1" />
    </>
  ),
  ram: (
    <>
      <path d="M2 8h20v8H2z" />
      <path d="M5 11h3v2H5zM10 11h3v2h-3zM15 11h3v2h-3z" />
      <path d="M4 16v2M7 16v2M10 16v2M14 16v2M17 16v2M20 16v2M11.5 16v2" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <rect x="6" y="6" width="5" height="5" />
      <path d="M15 5v7M17.5 5v7M6 15h12M6 18h8M11 8.5h2.5v4.5" />
      <circle cx="18" cy="18" r=".6" />
    </>
  ),
  ssd: (
    <>
      <rect x="2" y="9" width="18" height="6" rx=".6" />
      <path d="M20 10.5h2v3h-2M5 11h4v2H5zM11 11h3v2h-3z" />
      <circle cx="3.8" cy="12" r=".6" />
    </>
  ),
  psu: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 7v10M7 12h10M8.5 8.5l7 7M15.5 8.5l-7 7" />
    </>
  ),
  cooler: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="12" r="1.4" />
      <path d="M12 10.6c0-3 1-4.6 3.4-4.6.6 2.6-.9 4.2-3.4 4.6M13.4 12c3 0 4.6 1 4.6 3.4-2.6.6-4.2-.9-4.6-3.4M12 13.4c0 3-1 4.6-3.4 4.6-.6-2.6.9-4.2 3.4-4.6M10.6 12c-3 0-4.6-1-4.6-3.4 2.6-.6 4.2.9 4.6 3.4" />
    </>
  ),
};

export default function PartGlyph({ id, size = 24 }: { id: PartId; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[id]}
    </svg>
  );
}
