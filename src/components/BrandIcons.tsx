/**
 * Platform marks for the download buttons.
 *
 * Drawn inline rather than pulled from an icon package: lucide dropped brand
 * logos, and two small SVGs are cheaper than a dependency.
 */

export function WindowsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <rect x="2.5" y="2.5" width="9" height="9" rx="0.6" />
      <rect x="12.5" y="2.5" width="9" height="9" rx="0.6" />
      <rect x="2.5" y="12.5" width="9" height="9" rx="0.6" />
      <rect x="12.5" y="12.5" width="9" height="9" rx="0.6" />
    </svg>
  );
}

export function AndroidIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M2.8 18a9.2 9.2 0 0 1 18.4 0z" fill="currentColor" />
      <path
        d="M6.9 9.6 5.2 6.7M17.1 9.6l1.7-2.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8.3" cy="14" r="1.05" fill="#fff" />
      <circle cx="15.7" cy="14" r="1.05" fill="#fff" />
    </svg>
  );
}
