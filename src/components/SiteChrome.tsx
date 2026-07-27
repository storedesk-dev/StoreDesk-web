"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { NAV, SITE, contactMailto } from "@/lib/site";

const NAV_ITEMS = [{ href: "/", label: "Home" }, ...NAV] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ solid = false }: { solid?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/";

  return (
    <header
      className={`sticky top-0 z-50 border-b border-[var(--border)] bg-white shadow-sm shadow-blue-500/10 ${
        solid ? "" : "backdrop-blur-xl"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#1A63F4]/50 to-[#00A87B]/50" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="shrink-0">
          <Image
            src="/brand/logo-lockup-horizontal.jpg"
            alt={SITE.name}
            width={200}
            height={42}
            priority
            className="h-9 w-auto rounded bg-white object-contain p-1"
          />
        </Link>

        <LayoutGroup id="site-nav">
          <nav className="relative hidden items-center rounded-full bg-white/70 p-1 shadow-inner ring-1 ring-[var(--border)] md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative z-10 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    active ? "text-white" : "text-[var(--muted)] hover:text-[var(--sd-blue)]"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active-chip"
                      className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] shadow-md shadow-blue-500/30"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  ) : null}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href={SITE.github}
            className="rounded-full border border-[var(--border)] bg-white/80 px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--sd-blue)] hover:text-[var(--sd-blue)]"
          >
            GitHub
          </a>
          <a
            href={contactMailto({ subject: "StoreDesk inquiry" })}
            className="rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-3.5 py-1.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:brightness-105"
          >
            Email us
          </a>
        </div>

        <button
          type="button"
          className="rounded-lg border border-[var(--border)] bg-white/80 px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] md:hidden"
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
            className="overflow-hidden border-t border-[var(--border)] bg-white/95 md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${
                      active
                        ? "bg-gradient-to-r from-[#1A63F4] to-[#00A87B] text-white"
                        : "text-[var(--foreground)]"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <a
                href={contactMailto({ subject: "StoreDesk inquiry" })}
                className="mt-1 rounded-xl bg-[var(--surface)] px-3 py-2.5 text-sm font-bold text-[var(--sd-blue)]"
                onClick={() => setOpen(false)}
              >
                Email {SITE.email}
              </a>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-[var(--border)] bg-gradient-to-br from-[#0E43D8] via-[#1A63F4] to-[#00A87B] px-6 py-12 text-white">
      <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-[#28C88B]/25 blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Image
            src="/brand/logo-lockup-horizontal.jpg"
            alt={SITE.name}
            width={160}
            height={34}
            className="mb-3 h-8 w-auto rounded bg-white object-contain p-1.5"
          />
          <p className="max-w-sm text-sm text-white/85">{SITE.tagline}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-white/70">Explore</p>
          <ul className="mt-3 space-y-2 text-sm">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-white/70">Contact</p>
          <a href={contactMailto()} className="mt-3 block text-sm font-semibold underline decoration-white/40 hover:decoration-white">
            {SITE.email}
          </a>
          <div className="mt-4 flex gap-4 text-xs text-white/75">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
      <p className="relative mx-auto mt-10 max-w-6xl text-center text-xs text-white/65">
        © {new Date().getFullYear()} StoreDesk. Built for convenience stores & gas stations.
      </p>
    </footer>
  );
}
