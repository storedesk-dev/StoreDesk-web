"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowDownToLine, BookOpen, Menu, X } from "lucide-react";
import { DOCS, NAV, SITE } from "@/lib/site";

/** Home first, the four sections, then Contact (the header's one button is Download). */
const NAV_ITEMS = [{ href: "/", label: "Home" }, ...NAV, { href: "/contact", label: "Contact" }] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // "/product" owns its section except the lottery page, which has its own header item.
  if (href === "/product") return pathname === "/product" || (pathname.startsWith("/product/") && !pathname.startsWith("/product/lottery"));
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Site header: a glass bar in the brand's blue-to-mint, the nav centred in one pill with the current
 * page as a gradient chip, the guide as a link and Download as the one gradient button. The bar firms
 * up once the page scrolls, so content underneath never fights the type.
 *
 * Client only for the scroll state, the menu toggle on narrow screens and the current-page check.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname() || "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the menu on navigation, or it stays open over the new page.
  useEffect(() => setOpen(false), [pathname]);

  const onDownload = isActive(pathname, "/download");

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150 transition-[background-color,box-shadow] duration-300 ${
        scrolled
          ? "border-white/70 bg-gradient-to-r from-white/92 via-[#eef4ff]/90 to-[#e8faf3]/92 shadow-[0_8px_30px_-12px_rgba(26,99,244,0.28)]"
          : "border-white/50 bg-gradient-to-r from-white/80 via-[#eef4ff]/70 to-[#e8faf3]/75"
      }`}
    >
      {/* First tab stop on every page: jumps past the navigation to <main id="main">. */}
      <a href="#main" className="sd-skip-link">
        Skip to content
      </a>
      {/* Brand hairline along the bottom edge of the glass. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#1A63F4]/45 to-[#00875F]/45" />

      <div className="relative mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex min-h-11 w-fit items-center gap-2.5" aria-label={`${SITE.name} home`}>
          <Image
            src="/brand/logo-mark.png"
            alt=""
            width={64}
            height={64}
            priority
            className="h-8 w-8 object-contain drop-shadow-[0_2px_6px_rgba(26,99,244,0.25)]"
          />
          <span className="sd-wordmark whitespace-nowrap text-[18px] font-extrabold uppercase tracking-[0.03em]">Store Desk</span>
        </Link>

        <nav
          aria-label="Main"
          className="hidden items-center gap-0.5 rounded-full border border-white/70 bg-white/60 p-1 shadow-[inset_0_1px_2px_rgba(23,32,42,0.06),0_4px_16px_-8px_rgba(26,99,244,0.25)] backdrop-blur-md lg:flex"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-3.5 text-[14.5px] font-semibold transition-colors ${
                  active
                    ? "bg-gradient-to-r from-[#1A63F4] to-[#00875F] text-white shadow-[0_4px_14px_-4px_rgba(26,99,244,0.55)]"
                    : "text-[#475467] hover:bg-white/80 hover:text-[#1A63F4]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 justify-self-end lg:flex">
          {/* The user guide is its own site (docs.storedesk.net), so a plain anchor, not next/link. */}
          <a
            href={DOCS.home}
            className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[14.5px] font-semibold text-[#475467] transition-colors hover:text-[#1A63F4]"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            Guide
          </a>
          <Link
            href="/download"
            aria-current={onDownload ? "page" : undefined}
            className={`sd-btn !min-h-11 !px-5 !text-[14.5px] ${onDownload ? "ring-2 ring-white" : ""}`}
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden />
            Download
          </Link>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center justify-self-end rounded-full border border-white/70 bg-white/60 text-[var(--ink)] backdrop-blur-md lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {open ? (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-white/60 bg-white/90 backdrop-blur-xl lg:hidden">
          <ul className="flex flex-col gap-1 px-4 py-3">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center rounded-xl px-3.5 text-[17px] font-semibold ${
                      active
                        ? "bg-gradient-to-r from-[#1A63F4] to-[#00875F] text-white shadow-[0_4px_14px_-4px_rgba(26,99,244,0.5)]"
                        : "text-[var(--ink)] hover:bg-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <a href={DOCS.home} className="flex min-h-12 items-center gap-2 rounded-xl px-3.5 text-[17px] font-semibold text-[var(--ink)] hover:bg-white">
                <BookOpen className="h-4 w-4" aria-hidden />
                User guide
              </a>
            </li>
            <li className="pt-2">
              <Link href="/download" className="sd-btn w-full">
                <ArrowDownToLine className="h-4 w-4" aria-hidden />
                Download
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
