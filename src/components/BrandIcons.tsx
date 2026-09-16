/**
 * Platform marks for the download buttons.
 *
 * Drawn inline rather than pulled from an icon package: lucide dropped brand
 * logos, and two small SVGs are cheaper than a dependency.
 *
 * The Android robot used to live here. It went when the phone app was listed on Google Play: the
 * robot reads as a sideloaded APK, and the Play mark is what a store owner recognises.
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

/**
 * The Google Play triangle, in its four brand colours.
 *
 * Used instead of the Android robot on the download page: the app is listed on Play, and the Play
 * mark is what a store owner recognises and trusts. The robot reads as a sideloaded APK, which is
 * exactly the impression not to give.
 *
 * Four paths, one per face of the folded triangle, so it keeps Google's colours on any background.
 */
export function GooglePlayIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {/* Left face: the fold, from the play button's hinge. */}
      <path d="M3.4 2.3a1.4 1.4 0 0 0-.5 1.1v17.2a1.4 1.4 0 0 0 .5 1.1l.1.1 9.6-9.7v-.2L3.5 2.2z" fill="#00A0FF" />
      {/* Top-right face. */}
      <path d="M16.3 15.4 13.1 12.2v-.2l3.2-3.2.1.1 3.8 2.2c1.1.6 1.1 1.6 0 2.2z" fill="#FFBC00" />
      {/* Bottom face. */}
      <path d="m16.4 15.3-3.3-3.2-9.7 9.6c.4.4 1 .4 1.7 0z" fill="#FF3A44" />
      {/* Top face. */}
      <path d="M16.4 8.8 5.1 2.4c-.7-.4-1.3-.4-1.7 0l9.7 9.7z" fill="#00D781" />
    </svg>
  );
}
