"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export function MarketingShell({
  children,
  title,
  eyebrow
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
}) {
  return (
    <div className="min-h-screen text-[var(--foreground)]">
      <SiteHeader solid />
      <div className="relative overflow-hidden border-b border-[var(--border)] sd-hero-wash">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/80 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-6 py-14 md:py-20">
          {eyebrow ? (
            <p className="mb-4 inline-flex rounded-full bg-gradient-to-r from-[#1A63F4]/15 to-[#00A87B]/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-blue)]">
              {eyebrow}
            </p>
          ) : null}
          <motion.h1
            className="max-w-3xl text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {title}
          </motion.h1>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-14">{children}</div>
      <SiteFooter />
    </div>
  );
}
