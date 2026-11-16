import Image from "next/image";
import Link from "next/link";
import { CurrentVersion } from "@/components/CurrentVersion";
import { Wordmark } from "@/components/Wordmark";
import { DOCS, PRODUCT_NAV, SITE, contactMailto } from "@/lib/site";

/**
 * The footer: every public page, grouped the way an owner looks for them.
 *
 * No client code of its own (the version line is the one small client piece), so it renders on the
 * server from the server pages and as part of the client bundle only on the account pages that are
 * client components already. Flat navy, the same surface as the screenshot stage.
 */

type FooterLink = { href: string; label: string; external?: boolean };

const COLUMNS: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Product",
    links: PRODUCT_NAV.map((item) => ({ href: item.href, label: item.label }))
  },
  {
    title: "Get started",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/download", label: "Download" },
      { href: DOCS.install, label: "Install guide", external: true },
      { href: DOCS.connectRegister, label: "Connect your register", external: true },
      { href: DOCS.troubleshooting, label: "Troubleshooting", external: true },
      { href: DOCS.home, label: "User guide", external: true }
    ]
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/delete-account", label: "Delete your account" }
    ]
  }
];

export function SiteFooter() {
  const linkClass = "inline-flex min-h-11 items-center text-[15px] text-[var(--stage-text)] hover:text-white hover:underline sm:min-h-9";
  return (
    <footer className="sd-stage px-4 pb-10 pt-14 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2.5" aria-label={`${SITE.name} home`}>
            {/* Brand kit: on a dark surface the mark sits on a white chip. */}
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-white">
              <Image src="/brand/logo-mark.png" alt="" width={64} height={64} className="h-6 w-6" />
            </span>
            <Wordmark onDark />
          </Link>
          <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-[var(--stage-muted)]">{SITE.tagline}.</p>
          <a
            href={contactMailto()}
            className="mt-4 inline-flex min-h-11 items-center break-all text-[15px] font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
          >
            {SITE.email}
          </a>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="text-[15px] font-bold text-white">{column.title}</p>
            <ul className="mt-3 space-y-0.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  {link.external ? (
                    <a href={link.href} className={linkClass}>
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px] text-[var(--stage-muted)]">
          © {new Date().getFullYear()} StoreDesk. Verifone and Commander are trademarks of Verifone, Inc. StoreDesk is
          not affiliated with Verifone.
        </p>
        <CurrentVersion />
      </div>
    </footer>
  );
}
