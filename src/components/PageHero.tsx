"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

/**
 * Page frame for the product pages.
 *
 * Replaces MarketingShell's banner, which spent the whole first screen on a
 * title and a sentence. Here the title shares the first screen with the thing
 * the page is about — a working calculator, a walkthrough, a message composer —
 * so a visitor learns something before they scroll.
 */
export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-[var(--foreground)]">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  lede,
  actions,
  aside,
  children
}: {
  eyebrow: string;
  title: ReactNode;
  lede: ReactNode;
  actions?: ReactNode;
  /** The interactive piece that sits beside the title. */
  aside: ReactNode;
  /** Optional extra copy under the lede. */
  children?: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  // Transform-only: an opacity entrance ships invisible HTML (known-issues C-32).
  const rise = (delay: number) => ({
    initial: { y: reduceMotion ? 0 : 14 },
    animate: { y: 0 },
    transition: {
      duration: reduceMotion ? 0 : 0.5,
      delay: reduceMotion ? 0 : delay,
      ease: [0.22, 1, 0.36, 1] as const
    }
  });

  return (
    <section className="sd-hero-wash relative border-b border-[var(--border)]">
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 pb-14 pt-10 md:pt-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14 lg:pb-20">
        <div>
          <motion.p {...rise(0)} className="sd-eyebrow">
            {eyebrow}
          </motion.p>
          <motion.h1 {...rise(0.05)} className="sd-h1 mt-4">
            {title}
          </motion.h1>
          <motion.p {...rise(0.1)} className="sd-lede mt-5 max-w-xl">
            {lede}
          </motion.p>
          {children ? <motion.div {...rise(0.14)}>{children}</motion.div> : null}
          {actions ? (
            <motion.div {...rise(0.18)} className="mt-7 flex flex-wrap gap-3">
              {actions}
            </motion.div>
          ) : null}
        </div>
        <motion.div {...rise(0.12)} className="min-w-0">
          {aside}
        </motion.div>
      </div>
    </section>
  );
}

/** Section heading used below the hero on every product page. */
export function SectionHead({
  eyebrow,
  title,
  lede
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? <p className="sd-eyebrow">{eyebrow}</p> : null}
      <h2 className="sd-h2 mt-3">{title}</h2>
      {lede ? <p className="sd-lede mt-4">{lede}</p> : null}
    </div>
  );
}

export const primaryButton =
  "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-5 py-3 text-[15.5px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(26,99,244,0.6)] transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-110";

export const secondaryButton =
  "inline-flex items-center gap-2 rounded-full border border-[#1A63F4]/20 bg-white/80 px-5 py-3 text-[15.5px] font-semibold text-[#17202A] backdrop-blur transition-colors hover:border-[#1A63F4]/45 hover:text-[#1A63F4]";
