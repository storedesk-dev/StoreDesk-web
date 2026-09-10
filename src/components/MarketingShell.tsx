"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

/**
 * Frame for every page except the landing page.
 *
 * The header block is a grid ground with a rule under it, not a blurred
 * gradient — see `.sd-hero-wash`. `lede` exists so a page can say what it is in
 * a sentence instead of dropping the reader straight into body copy.
 */
export function MarketingShell({
  children,
  title,
  eyebrow,
  lede
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  lede?: string;
}) {
  const reduceMotion = useReducedMotion();
  const rise = (delay: number) => ({
    initial: { y: reduceMotion ? 0 : 10 },
    animate: { y: 0 },
    transition: { duration: reduceMotion ? 0 : 0.45, delay: reduceMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] as const }
  });

  return (
    <div className="min-h-screen text-[var(--foreground)]">
      <SiteHeader />
      <div className="sd-hero-wash relative border-b border-[var(--border)]">
        <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-20">
          {eyebrow ? (
            <motion.p
              {...rise(0)}
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1A63F4]"
            >
              {eyebrow}
            </motion.p>
          ) : null}
          <motion.h1
            {...rise(0.06)}
            className="max-w-3xl text-balance text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] md:text-[44px]"
          >
            {title}
          </motion.h1>
          {lede ? (
            <motion.p
              {...rise(0.12)}
              className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[var(--muted)]"
            >
              {lede}
            </motion.p>
          ) : null}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">{children}</div>
      <SiteFooter />
    </div>
  );
}
