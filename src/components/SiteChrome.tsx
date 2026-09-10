"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { NAV, SITE, contactMailto } from "@/lib/site";

const NAV_ITEMS = [{ href: "/", label: "Home" }, ...NAV] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Site header.
 *
 * Two deliberate changes from the previous version:
 *
 * The bar is 56px instead of 88px. It held a 64px-tall lockup on a single line,
 * which spent a tenth of a laptop viewport on a logo. The mark carries the
 * identity at small sizes; the wordmark sits beside it and drops on mobile.
 *
 * The background is one flat surface, not a gradient behind a blur behind
 * another gradient. Stacking those made the type sit on an inconsistent ground
 * and cost a compositing layer on every scroll frame.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname() || "/";
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on navigation, or it stays open behind the new page.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 bg-white/85 backdrop-blur-md transition-shadow duration-200 ${
        scrolled ? "border-b border-[var(--border)] shadow-[0_1px_12px_rgba(23,32,42,0.06)]" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${SITE.name} home`}>
          <Image
            src="/brand/logo-mark.png"
            alt=""
            width={64}
            height={64}
            priority
            className="h-7 w-7 object-contain"
          />
          <span className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
            Store<span className="text-[#00A87B]">Desk</span>
          </span>
        </Link>

        <LayoutGroup id="site-nav">
          <nav className="hidden flex-1 items-center gap-0.5 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors ${
                    active
                      ? "text-[var(--foreground)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {item.label}
                  {active ? (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-[#1A63F4]"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 400, damping: 32 }
                      }
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <a
            href={contactMailto({ subject: "StoreDesk enquiry" })}
            className="rounded-lg px-3 py-1.5 text-[14px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
          >
            Talk to us
          </a>
          <Link
            href="/download"
            className="rounded-lg bg-[#1A63F4] px-3.5 py-1.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0E43D8]"
          >
            Get StoreDesk
          </Link>
        </div>

        <button
          type="button"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-[var(--foreground)] md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <span className="relative block h-3.5 w-5">
            <motion.span
              className="absolute left-0 block h-[2px] w-5 rounded bg-current"
              animate={open ? { top: 6, rotate: 45 } : { top: 0, rotate: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            />
            <motion.span
              className="absolute left-0 top-[6px] block h-[2px] w-5 rounded bg-current"
              animate={{ opacity: open ? 0 : 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.12 }}
            />
            <motion.span
              className="absolute left-0 block h-[2px] w-5 rounded bg-current"
              animate={open ? { top: 6, rotate: -45 } : { top: 12, rotate: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            />
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-[var(--border)] bg-white md:hidden"
          >
            <div className="flex flex-col gap-0.5 px-4 py-3">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2.5 text-[15px] font-medium ${
                    isActive(pathname, item.href)
                      ? "bg-[#1A63F4]/8 text-[#1A63F4]"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/download"
                className="mt-2 rounded-lg bg-[#1A63F4] px-3 py-2.5 text-center text-[15px] font-semibold text-white"
              >
                Get StoreDesk
              </Link>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[#F8FAFC] px-6 py-14">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/logo-mark.png"
              alt=""
              width={64}
              height={64}
              className="h-7 w-7 object-contain"
            />
            <span className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
              Store<span className="text-[#00A87B]">Desk</span>
            </span>
          </div>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--muted)]">
            {SITE.tagline}. Built by people who have worked the counter.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Product
          </p>
          <ul className="mt-3.5 space-y-2.5 text-[14px]">
            {NAV_ITEMS.slice(1).map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-[var(--foreground)] transition-colors hover:text-[#1A63F4]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/download" className="text-[var(--foreground)] transition-colors hover:text-[#1A63F4]">
                Download
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
            Get in touch
          </p>
          <a
            href={contactMailto()}
            className="mt-3.5 block text-[14px] font-medium text-[#1A63F4] hover:underline"
          >
            {SITE.email}
          </a>
          <ul className="mt-3.5 space-y-2.5 text-[14px]">
            <li>
              <Link href="/privacy" className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-6xl border-t border-[var(--border)] pt-6">
        <p className="text-[13px] text-[var(--muted)]">
          © {new Date().getFullYear()} StoreDesk. Verifone and Commander are trademarks of
          Verifone, Inc. StoreDesk is not affiliated with Verifone.
        </p>
      </div>
    </footer>
  );
}
