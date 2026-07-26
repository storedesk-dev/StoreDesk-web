"use client";

/** Compatibility badge — text lockup; Verifone is a trademark of Verifone, Inc. */
export function VerifoneBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-white/95 px-3 py-2 shadow-sm shadow-blue-500/10 ${className}`}
      title="Works with Verifone Commander POS"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B1F3A] text-white" aria-hidden>
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none">
          <path d="M6 8h20l-4 16H10L6 8Z" fill="#1A63F4" />
          <path d="M11 12h10l-1.2 5H12.2L11 12Z" fill="#28C88B" />
          <path d="M8 24h16" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-left leading-tight">
        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Works with</span>
        <span className="block text-sm font-bold text-[var(--foreground)]">
          Verifone<sup className="text-[9px]">®</sup> Commander
        </span>
      </span>
    </div>
  );
}
