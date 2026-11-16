"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import { DOCS, NAV, SITE } from "@/lib/site";

function isActive(pathname: string, href: string) {
  // "/product" owns its section except the lottery page, which has its own header item.
  if (href === "/product") return pathname === "/product" || (pathname.startsWith("/product/") && !pathname.startsWith("/product/lottery"));
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Site header: solid white, one rule under it. The current page carries a blue underline and
 * aria-current. Contact is the one filled button; Download and the guide are plain links beside it.
 *
 * Client only for the menu toggle on narrow screens and the current-page check.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/";

  // Close the menu on navigation, or it stays open over the new page.
  useEffect(() => setOpen(false), [pathname]);

  const linkClass = (active: boolean) =>
    `relative inline-flex min-h-11 items-center px-3 text-[15px] font-semibold transition-colors ${
      active
        ? "text-[var(--ink)] after:absolute after:inset-x-3 after:bottom-1.5 after:h-[2px] after:rounded-full after:bg-[var(--blue)]"
        : "text-[var(--muted)] hover:text-[var(--ink)]"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-white">
      {/* First tab stop on every page: jumps past the navigation to <main id="main">. */}
      <a href="#main" className="sd-skip-link">
        Skip to content
      </a>

      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5" aria-label={`${SITE.name} home`}>
          <Image src="/brand/logo-mark.png" alt="" width={64} height={64} priority className="h-8 w-8" />
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center md:flex">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-1 md:flex">
          {/* The user guide is its own site (docs.storedesk.net), so a plain anchor, not next/link. */}
          <a href={DOCS.home} className={linkClass(false)}>
            Guide
          </a>
          <Link href="/download" aria-current={pathname === "/download" ? "page" : undefined} className={linkClass(pathname === "/download")}>
            Download
          </Link>
          <Link
            href="/contact"
            aria-current={pathname === "/contact" ? "page" : undefined}
            className="ml-2 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-[var(--blue)] px-4 text-[15px] font-bold text-white transition-colors hover:bg-[var(--blue-ink)]"
          >
            Contact us
          </Link>
        </div>

        <button
          type="button"
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--line)] text-[var(--ink)] md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {open ? (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-[var(--line)] bg-white md:hidden">
          <ul className="flex flex-col px-4 py-3">
            {[...NAV, { href: "/download", label: "Download" }].map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center border-b border-[var(--line)] text-[17px] font-semibold ${
                      active ? "text-[var(--blue-ink)]" : "text-[var(--ink)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <a href={DOCS.home} className="flex min-h-12 items-center border-b border-[var(--line)] text-[17px] font-semibold text-[var(--ink)]">
                User guide
              </a>
            </li>
            <li className="pt-3">
              <Link
                href="/contact"
                className="flex min-h-12 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--blue)] text-[17px] font-bold text-white"
              >
                Contact us
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
