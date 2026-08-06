"use client";

import Image from "next/image";

/** Compatibility badge featuring the official Verifone image lockup */
export function VerifoneBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-white/95 px-3.5 py-2 shadow-sm shadow-blue-500/10 ${className}`}
      title="Works with Verifone Commander POS"
    >
      <div className="relative h-8 w-12 shrink-0 overflow-hidden rounded-lg bg-[#0B1F3A] p-0.5">
        <Image
          src="/Verifone image.png"
          alt="Verifone POS"
          width={80}
          height={50}
          className="h-full w-full object-contain"
        />
      </div>
      <span className="text-left leading-tight">
        <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Works with</span>
        <span className="block text-sm font-bold text-[var(--foreground)]">
          Verifone<sup className="text-[9px]">®</sup> Commander
        </span>
      </span>
    </div>
  );
}
