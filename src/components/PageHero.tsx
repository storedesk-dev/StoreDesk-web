import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { breadcrumbJsonLd } from "@/lib/metadata";
import { jsonLdScript } from "@/lib/json-ld";

/**
 * The building blocks every public page is made of. Server components: no motion and no client
 * code, so a content page ships only the header's menu toggle plus whatever interactive piece the
 * page itself chooses to add.
 */

export const primaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--blue)] px-5 text-[16px] font-bold text-white transition-colors hover:bg-[var(--blue-ink)]";

/** The second action is a text link, never a second button competing with the first. */
export const textLink =
  "inline-flex min-h-12 items-center gap-1.5 text-[16px] font-bold text-[var(--blue-ink)] underline decoration-[var(--blue-ink)]/30 underline-offset-4 hover:decoration-[var(--blue-ink)]";

/** Kept for pages that need a bordered second button (download alternatives, account pages). */
export const secondaryButton =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white px-5 text-[16px] font-bold text-[var(--ink)] transition-colors hover:border-[var(--blue)] hover:text-[var(--blue-ink)]";

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--wash)] text-[var(--ink)]">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}

export type Crumb = { name: string; path: string };

/** The visible trail and its `BreadcrumbList`, from one array so the two cannot disagree. */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", ...breadcrumbJsonLd(trail) }} />
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-[15px] text-[var(--muted)]">
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1;
            return (
              <li key={crumb.path} className="flex items-center gap-1">
                {last ? (
                  <span aria-current="page" className="font-semibold text-[var(--ink)]">
                    {crumb.name}
                  </span>
                ) : (
                  <>
                    <Link href={crumb.path} className="inline-flex min-h-11 items-center hover:text-[var(--blue-ink)] hover:underline">
                      {crumb.name}
                    </Link>
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/**
 * The top of a page: optional trail, the h1, one sentence, one action. `aside` is what the page is
 * about (a real screenshot, or the one interactive piece), beside the title on wide screens.
 */
export function PageHero({
  trail,
  title,
  lede,
  actions,
  aside,
  children
}: {
  trail?: Crumb[];
  title: ReactNode;
  lede: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--line)] bg-white">
      <div
        className={`mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-8 sm:px-6 md:pt-10 lg:pb-16 ${
          aside ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-12" : ""
        }`}
      >
        <div className="min-w-0">
          {trail ? <Breadcrumbs trail={trail} /> : null}
          <h1 className={`sd-h1 max-w-3xl ${trail ? "mt-4" : "mt-2"}`}>{title}</h1>
          <p className="sd-lede mt-5">{lede}</p>
          {children}
          {actions ? <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">{actions}</div> : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}

/** A page section. `tone` alternates between the two light surfaces; never more than two. */
export function Section({
  id,
  title,
  lede,
  tone = "wash",
  children,
  width = "wide"
}: {
  id?: string;
  title: ReactNode;
  lede?: ReactNode;
  tone?: "wash" | "white";
  children: ReactNode;
  width?: "wide" | "narrow";
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`border-b border-[var(--line)] ${tone === "white" ? "bg-white" : "bg-[var(--wash)]"}`}
    >
      <div className={`mx-auto px-4 py-16 sm:px-6 md:py-20 ${width === "narrow" ? "max-w-4xl" : "max-w-6xl"}`}>
        <h2 id={headingId} className="sd-h2 max-w-3xl">
          {title}
        </h2>
        {lede ? <p className="sd-lede mt-4">{lede}</p> : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

/** A plain list with green ticks: things that are true today. */
export function CheckList({ items, className = "" }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={`space-y-3 ${className}`}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[17px] leading-snug">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--green-ink)]" aria-hidden />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A real screenshot from the demo store, on the navy stage the app itself uses.
 *
 * The desktop shots are 2560×1600 from the user guide (store-desk-docs, "Demo Mart"); next/image
 * serves a size to match `sizes`, so the browser never downloads the full capture.
 */
export function Screenshot({
  src,
  alt,
  width = 2560,
  height = 1600,
  sizes = "(min-width: 1024px) 620px, 100vw",
  priority = false,
  caption,
  className = ""
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={`sd-stage rounded-[var(--radius-lg)] p-2 sm:p-3 ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        className="h-auto w-full rounded-[var(--radius-md)] shadow-[var(--shadow-shot)]"
      />
      {caption ? <figcaption className="px-2 pb-1 pt-3 text-[14px] text-[var(--stage-muted)]">{caption}</figcaption> : null}
    </figure>
  );
}

/** A phone screenshot with a plain body around it, so it reads as a phone at a glance. */
export function PhoneShot({
  src,
  alt,
  priority = false,
  sizes = "260px",
  className = ""
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-[34px] bg-[var(--stage)] p-2 shadow-[var(--shadow-shot)] ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={720}
        height={1412}
        sizes={sizes}
        priority={priority}
        className="h-auto w-full rounded-[26px]"
      />
    </div>
  );
}
