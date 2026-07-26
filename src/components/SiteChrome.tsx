"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NAV, SITE } from "@/lib/site";

export function SiteHeader({ solid = false }: { solid?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      className={`relative z-50 border-b border-white/10 ${solid ? "bg-[#050608]/95 backdrop-blur" : "bg-transparent"}`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="shrink-0">
          <Image
            src="/brand/logo-lockup-horizontal.svg"
            alt={SITE.name}
            width={150}
            height={32}
            className="brightness-110"
            priority
          />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-white/65 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-white">
              {item.label}
            </Link>
          ))}
          <a
            href={SITE.github}
            className="rounded-full border border-white/20 px-3 py-1.5 text-white/90 transition hover:border-white/40"
          >
            GitHub
          </a>
        </nav>
        <button
          type="button"
          className="rounded-lg border border-white/15 px-3 py-1.5 text-sm font-bold text-white md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Menu
        </button>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/10 bg-[#050608] md:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-3">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-2 py-2 text-sm font-semibold text-white/80"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-black/60 px-6 py-12 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Image src="/brand/logo-mark.svg" alt="" width={40} height={40} className="mb-3" />
          <p className="max-w-sm text-sm text-white/50">{SITE.tagline}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-white/35">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-white/35">Contact</p>
          <a href={`mailto:${SITE.email}`} className="mt-3 block text-sm text-[var(--sd-mint)] hover:underline">
            {SITE.email}
          </a>
          <div className="mt-4 flex gap-4 text-xs text-white/40">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl text-center text-xs text-white/30">
        © {new Date().getFullYear()} StoreDesk. Built for convenience stores & gas stations.
      </p>
    </footer>
  );
}
