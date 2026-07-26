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
    <div className="min-h-screen bg-[#050608] text-white">
      <SiteHeader solid />
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(26,99,244,0.25),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-20">
          {eyebrow ? (
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--sd-mint)]">{eyebrow}</p>
          ) : null}
          <motion.h1
            className="max-w-3xl text-4xl font-extrabold tracking-tight md:text-5xl"
            style={{ fontFamily: "var(--font-display), system-ui, sans-serif" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {title}
          </motion.h1>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 py-14">{children}</div>
      <SiteFooter />
    </div>
  );
}
