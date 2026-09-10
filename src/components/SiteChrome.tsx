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
 * Site header — glass bar, nav centred, active page as a brand-gradient chip.
 *
 * Three columns (logo · nav · actions) so the nav sits on the true centre of
 * the page regardless of how wide the logo and buttons are. The bar stays 56px
 * tall; the glass effect is one translucent surface plus a brand hairline, and
 * it firms up once the page scrolls so content underneath never fights the type.
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

  const chipSpring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 420, damping: 34 };

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150 transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled
          ? "border-white/70 bg-gradient-to-r from-white/90 via-[#eef4ff]/85 to-[#e8faf3]/90 shadow-[0_8px_30px_-12px_rgba(26,99,244,0.28)]"
          : "border-white/50 bg-gradient-to-r from-white/75 via-[#eef4ff]/65 to-[#e8faf3]/70 shadow-sm shadow-blue-500/5"
      }`}
    >
      {/* Brand hairline along the bottom edge of the glass. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#1A63F4]/45 to-[#00A87B]/45" />

      <div className="relative mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-6">
        <Link
          href="/"
          className="flex w-fit items-center gap-2.5 justify-self-start"
          aria-label={`${SITE.name} home`}
        >
          <Image
            src="/brand/logo-mark.png"
            alt=""
            width={64}
            height={64}
            priority
            className="h-7 w-7 object-contain drop-shadow-[0_2px_6px_rgba(26,99,244,0.25)]"
          />
          <span className="text-[17px] font-semibold tracking-tight text-[#17202A]">
            Store<span className="text-[#00A87B]">Desk</span>
          </span>
        </Link>

        <LayoutGroup id="site-nav">
          <nav className="hidden items-center gap-0.5 rounded-full border border-white/70 bg-white/50 p-1 shadow-[inset_0_1px_2px_rgba(23,32,42,0.06),0_4px_16px_-8px_rgba(26,99,244,0.25)] backdrop-blur-md md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors ${
                    active ? "text-white" : "text-[#475467] hover:text-[#1A63F4]"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active-chip"
                      className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] shadow-[0_4px_14px_-4px_rgba(26,99,244,0.55)]"
                      transition={chipSpring}
                    />
                  ) : null}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>

        <div className="hidden items-center gap-2 justify-self-end md:flex">
          <Link
            href="/download"
            className={`rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold backdrop-blur-md transition-colors ${
              isActive(pathname, "/download")
                ? "border-[#1A63F4]/40 bg-white text-[#1A63F4]"
                : "border-[#1A63F4]/20 bg-white/60 text-[#1A63F4] hover:bg-white"
            }`}
          >
            Download
          </Link>
          <a
            href={contactMailto({ subject: "StoreDesk enquiry" })}
            className="rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-4 py-1.5 text-[13.5px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(26,99,244,0.55)] transition-[filter] hover:brightness-110"
          >
            Email us
          </a>
        </div>

        <button
          type="button"
          className="col-start-3 flex h-9 w-9 items-center justify-center justify-self-end rounded-full border border-white/70 bg-white/50 text-[#17202A] backdrop-blur-md md:hidden"
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
            className="overflow-hidden border-t border-white/60 bg-white/80 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-3">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-xl px-3.5 py-2.5 text-[15px] font-semibold ${
                      active
                        ? "bg-gradient-to-r from-[#1A63F4] to-[#00A87B] text-white shadow-[0_4px_14px_-4px_rgba(26,99,244,0.5)]"
                        : "text-[#17202A] hover:bg-white/70"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <Link
                href="/download"
                className="mt-2 rounded-xl border border-[#1A63F4]/20 bg-white/70 px-3 py-2.5 text-center text-[15px] font-semibold text-[#1A63F4]"
              >
                Download
              </Link>
              <a
                href={contactMailto({ subject: "StoreDesk enquiry" })}
                className="rounded-xl bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-3 py-2.5 text-center text-[15px] font-semibold text-white"
              >
                Email us
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
    <footer className="relative overflow-hidden bg-gradient-to-br from-[#0E43D8] via-[#1A63F4] to-[#00A87B] px-6 py-14 text-white">
      {/* Soft light pools, kept to the corners so the text sits on clean colour. */}
      <div className="pointer-events-none absolute -right-24 -top-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#28C88B]/25 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            {/* Brand kit: on a dark surface the mark sits on a white chip. */}
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-md shadow-black/10">
              <Image src="/brand/logo-mark.png" alt="" width={64} height={64} className="h-6 w-6 object-contain" />
            </span>
            <span className="text-[18px] font-semibold tracking-tight">StoreDesk</span>
          </div>
          <p className="mt-4 max-w-sm text-[14.5px] leading-relaxed text-white/85">
            {SITE.tagline}. Runs on the PC in your back office and keeps working when the
            internet does not.
          </p>
          <a
            href="/download"
            className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1A63F4] shadow-md shadow-black/10 transition-transform hover:-translate-y-0.5"
          >
            Get StoreDesk
          </a>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65">Product</p>
          <ul className="mt-4 space-y-2.5 text-[14px]">
            {NAV_ITEMS.slice(1).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-white/90 transition-colors hover:text-white hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/download" className="text-white/90 transition-colors hover:text-white hover:underline">
                Download
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/65">Get in touch</p>
          <a
            href={contactMailto()}
            className="mt-4 block text-[14px] font-semibold underline decoration-white/40 underline-offset-4 hover:decoration-white"
          >
            {SITE.email}
          </a>
          <ul className="mt-4 space-y-2.5 text-[14px]">
            <li>
              <Link href="/privacy" className="text-white/80 transition-colors hover:text-white">Privacy</Link>
            </li>
            <li>
              <Link href="/terms" className="text-white/80 transition-colors hover:text-white">Terms</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="relative mx-auto mt-12 max-w-6xl border-t border-white/20 pt-6">
        <p className="text-[12.5px] text-white/70">
          © {new Date().getFullYear()} StoreDesk. Built for convenience stores and gas stations.
          Verifone and Commander are trademarks of Verifone, Inc.; StoreDesk is not affiliated with Verifone.
        </p>
      </div>
    </footer>
  );
}
