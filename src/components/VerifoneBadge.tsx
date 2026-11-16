import Image from "next/image";

/**
 * "Works with Verifone Commander". The wordmark is black with a cyan stroke, so it sits on a white
 * card whatever the surface behind it: the logo, a rule, then "Works with / Commander" stacked.
 */
export function VerifoneBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex min-h-14 items-center gap-3.5 rounded-2xl border border-[rgba(14,67,216,0.12)] bg-white px-5 py-2.5 shadow-[var(--shadow-card)] ${className}`}
    >
      <Image src="/brand/verifone-wordmark.png" alt="Verifone" width={180} height={33} className="h-[22px] w-auto" />
      <span className="h-8 w-px bg-[var(--line-strong)]" aria-hidden="true" />
      <span className="text-left leading-tight">
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Works with</span>
        <span className="block text-[16px] font-extrabold text-[var(--ink)]">Commander</span>
      </span>
    </div>
  );
}
