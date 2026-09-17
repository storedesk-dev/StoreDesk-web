"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownToLine, BookOpen, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { DOCS, NAV, SITE, contactMailto } from "@/lib/site";
import { useRelease } from "@/components/ReleaseContext";

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
          {/* The lockup's wordmark, set as live text so it stays crisp on glass. */}
          <span className="sd-wordmark hidden whitespace-nowrap md:inline font-[family-name:var(--font-display)] text-[17px] font-extrabold uppercase tracking-[0.03em]">
            Store Desk
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
          {/* The user guide is its own site (docs.storedesk.net), so a plain anchor, not next/link. */}
          <a
            href={DOCS.home}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-[#475467] transition-colors hover:text-[#1A63F4]"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            Guide
          </a>
          <Link
            href="/download"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold backdrop-blur-md transition-colors ${
              isActive(pathname, "/download")
                ? "border-[#1A63F4]/40 bg-white text-[#1A63F4]"
                : "border-[#1A63F4]/20 bg-white/60 text-[#1A63F4] hover:bg-white"
            }`}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden />
            Download
          </Link>
          <a
            href={contactMailto({ subject: "StoreDesk enquiry" })}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-4 py-1.5 text-[13.5px] font-semibold text-white shadow-[0_4px_14px_-4px_rgba(26,99,244,0.55)] transition-[filter] hover:brightness-110"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
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
              <a
                href={DOCS.home}
                className="mt-2 inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[15px] font-semibold text-[#17202A] hover:bg-white/70"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Guide
              </a>
              <Link
                href="/download"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1A63F4]/20 bg-white/70 px-3 py-2.5 text-[15px] font-semibold text-[#1A63F4]"
              >
                <ArrowDownToLine className="h-4 w-4" aria-hidden />
                Download
              </Link>
              <a
                href={contactMailto({ subject: "StoreDesk enquiry" })}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-3 py-2.5 text-[15px] font-semibold text-white"
              >
                <Mail className="h-4 w-4" aria-hidden />
                Email us
              </a>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/**
 * What is published right now, on every page. It comes from the downloads site through the layout
 * (components/ReleaseContext), so it is never a number someone has to remember to edit; when that
 * read fails it renders nothing rather than a stale version.
 */
function CurrentVersion() {
  const release = useRelease();
  if (!release) return null;
  return (
    <p className="sd-num shrink-0 text-[12.5px] text-[#A3AEBF]">
      StoreDesk {release.version}
      {release.channel === "beta" ? " (beta)" : ""} ·{" "}
      <a href={release.notesUrl} className="font-semibold text-[#6E9BFA] underline decoration-[#6E9BFA]/40 underline-offset-4 hover:decoration-[#6E9BFA]">
        What&rsquo;s new
      </a>
    </p>
  );
}

export function SiteFooter() {
  return (
    /*
     * The same dark surface as the desktop app in dark mode: background #0A1224, text #F3F4F6,
     * secondary #A3AEBF, dividers at 10% white (store-desk-electron/src/theme). The footer used to be
     * a blue-to-green gradient, which put white body copy on a moving, mid-light ground and never
     * reached a comfortable contrast; a flat dark panel reads cleanly and makes the site and the app
     * look like one product.
     */
    <footer className="relative overflow-hidden bg-[#0A1224] px-6 py-14 text-[#F3F4F6]">
      {/* A single quiet brand wash, well away from the text. */}
      <div className="pointer-events-none absolute -right-32 -top-24 h-72 w-72 rounded-full bg-[#1A63F4]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#10B981]/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1.1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            {/* Brand kit: on a dark surface the mark sits on a white chip. */}
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-md shadow-black/10">
              <Image src="/brand/logo-mark.png" alt="" width={64} height={64} className="h-6 w-6 object-contain" />
            </span>
            <span className="font-[family-name:var(--font-display)] text-[18px] font-extrabold uppercase tracking-[0.03em]">Store Desk</span>
          </div>
          <p className="mt-4 max-w-sm text-[14.5px] leading-relaxed text-[#A3AEBF]">
            {SITE.tagline}. Runs on the PC in your back office and keeps working when the
            internet does not.
          </p>
          <a
            href="/download"
            className="mt-5 inline-flex rounded-full bg-[#10B981] px-4 py-2 text-[13.5px] font-semibold text-[#0B0F19] shadow-md shadow-black/30 transition-transform hover:-translate-y-0.5"
          >
            Get StoreDesk
          </a>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A97AC]">Product</p>
          <ul className="mt-4 space-y-2.5 text-[14px]">
            {NAV_ITEMS.slice(1).map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-[#E4E7EC] transition-colors hover:text-white hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/download" className="text-[#E4E7EC] transition-colors hover:text-white hover:underline">
                Download
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A97AC]">Support</p>
          <ul className="mt-4 space-y-2.5 text-[14px]">
            {[
              { href: DOCS.home, label: "User guide" },
              { href: DOCS.install, label: "Install StoreDesk" },
              { href: DOCS.connectRegister, label: "Connect your register" },
              { href: DOCS.troubleshooting, label: "Troubleshooting" },
              { href: DOCS.releaseNotes, label: "What's new" }
            ].map((item) => (
              <li key={item.href}>
                <a href={item.href} className="text-[#E4E7EC] transition-colors hover:text-white hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8A97AC]">Get in touch</p>
          <a
            href={contactMailto()}
            className="mt-4 block text-[14px] font-semibold text-[#6E9BFA] underline decoration-[#6E9BFA]/50 underline-offset-4 hover:decoration-[#6E9BFA]"
          >
            {SITE.email}
          </a>
          <ul className="mt-4 space-y-2.5 text-[14px]">
            <li>
              <Link href="/privacy" className="text-[#A3AEBF] transition-colors hover:text-white">Privacy</Link>
            </li>
            <li>
              <Link href="/terms" className="text-[#A3AEBF] transition-colors hover:text-white">Terms</Link>
            </li>
            <li>
              <Link href="/delete-account" className="text-[#A3AEBF] transition-colors hover:text-white">Delete your account</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="relative mx-auto mt-12 flex max-w-6xl flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-[#A3AEBF]">
          © {new Date().getFullYear()} StoreDesk. Built for convenience stores and gas stations.
          Verifone and Commander are trademarks of Verifone, Inc.; StoreDesk is not affiliated with Verifone.
        </p>
        <CurrentVersion />
      </div>
    </footer>
  );
}
