import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { breadcrumbJsonLd } from "@/lib/metadata";
import { jsonLdScript } from "@/lib/json-ld";

/**
 * The building blocks every public page is made of. Server components: the only motion is CSS (the
 * hero's entrance once on load, hover lifts, slow drifting cards), so a content page ships no motion
 * library. Look: globals.css, "Brand layer".
 */

export const primaryButton = "sd-btn";

/** The second action beside the gradient button: the white pill. */
export const textLink = "sd-btn-ghost";

/** Kept for pages that need a bordered second button (download alternatives, account pages). */
export const secondaryButton = "sd-btn-ghost";

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-[var(--ink)]">
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
 * The top of a page on the grid ground: optional trail, an eyebrow, the h1 (wrap its key phrase in
 * `<em className="sd-grad">`), one sentence, the actions. `aside` is what the page is about (a real
 * screen in its frame, or the one interactive piece), beside the title on wide screens. The copy and
 * the aside enter once on load.
 */
export function PageHero({
  trail,
  eyebrow,
  title,
  lede,
  actions,
  aside,
  children
}: {
  trail?: Crumb[];
  eyebrow?: string;
  title: ReactNode;
  lede: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="sd-hero-grid border-b border-[var(--line)]">
      <div
        className={`mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 sm:px-6 md:pt-10 lg:pb-20 ${
          aside ? "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center lg:gap-12" : ""
        }`}
      >
        <div className="sd-enter min-w-0">
          {trail ? <Breadcrumbs trail={trail} /> : null}
          {eyebrow ? <p className={`sd-eyebrow ${trail ? "mt-5" : "mt-4"}`}>{eyebrow}</p> : null}
          <h1 className={`sd-h1 max-w-3xl ${eyebrow ? "mt-3" : trail ? "mt-4" : "mt-2"}`}>{title}</h1>
          <p className="sd-lede mt-5">{lede}</p>
          {children}
          {actions ? <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">{actions}</div> : null}
        </div>
        {aside ? <div className="sd-enter-3 min-w-0">{aside}</div> : null}
      </div>
    </section>
  );
}

/** A page section. `tone` alternates the brand bands: blue-tinted and green-tinted. */
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
      className={`border-b border-[var(--line)] ${tone === "white" ? "sd-band-green" : "sd-band-blue"}`}
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

/**
 * A phone screen in a phone body: dark bezel, side buttons, rounded glass. `width`/`height` are the
 * screenshot's own pixels (the 0.2.1 captures are 720x1565).
 */
export function PhoneShot({
  src,
  alt,
  priority = false,
  sizes = "260px",
  width = 720,
  height = 1565,
  className = ""
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes?: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-[2.6rem] border-[8px] border-[#0f172a] bg-[#0f172a] shadow-[0_30px_60px_-20px_rgba(11,31,77,0.45)] ring-1 ring-white/30 ${className}`}
    >
      <span aria-hidden className="absolute -left-[11px] top-[18%] h-10 w-[3px] rounded-l bg-[#1e293b]" />
      <span aria-hidden className="absolute -left-[11px] top-[27%] h-10 w-[3px] rounded-l bg-[#1e293b]" />
      <span aria-hidden className="absolute -right-[11px] top-[22%] h-14 w-[3px] rounded-r bg-[#1e293b]" />
      <Image src={src} alt={alt} width={width} height={height} sizes={sizes} priority={priority} className="h-auto w-full rounded-[2rem]" />
    </div>
  );
}

/** A floating card over a frame: a small icon tile, a label and what the screen is for. */
export function FloatCard({
  icon,
  label,
  text,
  tone = "blue",
  className = ""
}: {
  icon: ReactNode;
  label: string;
  text: string;
  tone?: "blue" | "green";
  className?: string;
}) {
  return (
    <div className={`sd-float ${className}`} aria-hidden>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${
          tone === "green" ? "bg-[#00a87b]" : "bg-[#1a63f4]"
        }`}
      >
        {icon}
      </span>
      <span className="leading-tight">
        <span className="sd-float-label block">{label}</span>
        <span className={`block text-[15px] font-extrabold ${tone === "green" ? "text-[var(--green-ink)]" : "text-[var(--ink)]"}`}>{text}</span>
      </span>
    </div>
  );
}
