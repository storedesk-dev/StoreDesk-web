"use client";

import Image from "next/image";

/**
 * "Works with Verifone Commander" badge.
 *
 * The wordmark is black with a cyan stroke, so it sits on the badge's white
 * ground. It used to be squeezed into a 48×32 navy tile, where the black
 * letters all but disappeared.
 */
export function VerifoneBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-2.5 shadow-sm shadow-blue-500/10 ${className}`}
      title="Works with Verifone Commander"
    >
      <Image
        src="/brand/verifone-wordmark.png"
        alt="Verifone"
        width={180}
        height={33}
        className="h-[18px] w-auto"
        priority
      />
      <span className="h-7 w-px bg-[var(--border)]" aria-hidden="true" />
      <span className="text-left leading-tight">
        <span className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Works with</span>
        <span className="block text-[14px] font-bold text-[var(--foreground)]">Commander</span>
      </span>
    </div>
  );
}
