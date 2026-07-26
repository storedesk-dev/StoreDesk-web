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
      className={`relative z-50 border-b border-[var(--border)] ${
        solid ? "bg-white/95 backdrop-blur" : "bg-white/80 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="shrink-0">
          <Image
            src="/brand/logo-lockup-horizontal.svg"
            alt={SITE.name}
            width={168}
            height={36}
            priority
            className="h-9 w-auto"
          />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[var(--muted)] md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-[var(--sd-blue)]">
              {item.label}
            </Link>
          ))}
          <a
            href={SITE.github}
            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[var(--foreground)] transition hover:border-[var(--sd-blue)] hover:text-[var(--sd-blue)]"
          >
            GitHub
          </a>
        </nav>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] md:hidden"
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
            className="overflow-hidden border-t border-[var(--border)] bg-white md:hidden"
          >
            <div className="flex flex-col gap-1 px-6 py-3">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-2 py-2 text-sm font-semibold text-[var(--foreground)]"
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
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-[var(--foreground)]">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Image
            src="/brand/logo-lockup-horizontal.svg"
            alt={SITE.name}
            width={160}
            height={34}
            className="mb-3 h-8 w-auto"
          />
          <p className="max-w-sm text-sm text-[var(--muted)]">{SITE.tagline}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--foreground)]">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-[var(--sd-blue)]">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Contact</p>
          <a href={`mailto:${SITE.email}`} className="mt-3 block text-sm font-semibold text-[var(--sd-blue)] hover:underline">
            {SITE.email}
          </a>
          <div className="mt-4 flex gap-4 text-xs text-[var(--muted)]">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl text-center text-xs text-[var(--muted)]">
        © {new Date().getFullYear()} StoreDesk. Built for convenience stores & gas stations.
      </p>
    </footer>
  );
}
