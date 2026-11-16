import Image from "next/image";

/**
 * "Works with Verifone Commander". The wordmark is black with a cyan stroke, so it sits on a white
 * chip whatever the surface behind it.
 */
export function VerifoneBadge({ className = "" }: { className?: string }) {
  return (
    <p className={`inline-flex items-center gap-3 rounded-[var(--radius-md)] bg-white px-4 py-2.5 ${className}`}>
      <span className="text-[15px] font-semibold text-[var(--muted)]">Works with</span>
      <Image src="/brand/verifone-wordmark.png" alt="Verifone" width={180} height={33} className="h-[18px] w-auto" />
      <span className="text-[15px] font-bold text-[var(--ink)]">Commander</span>
    </p>
  );
}
