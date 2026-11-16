import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { CheckList, PageFrame, PageHero, Section, primaryButton, secondaryButton } from "@/components/PageHero";
import { PRODUCTS, PRODUCT_ORDER, type ProductEntry } from "./products";

/**
 * One app's page: what it does, then the four things an owner checks before buying (who uses it,
 * how it connects, what it needs, what is not built yet), then the other apps.
 *
 * `extra` is the page's own section, placed after the job list (the margin check on Desktop, the
 * shift close on Lottery).
 */
/** "StoreDesk Mobile: your store on an Android phone": the part after the colon in the brand gradient. */
function titleWithAccent(title: string) {
  const at = title.indexOf(": ");
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at + 1)} <em className="sd-grad">{title.slice(at + 2)}</em>
    </>
  );
}

export function ProductDetail({
  product,
  title,
  aside,
  extra
}: {
  product: ProductEntry;
  title: string;
  aside: ReactNode;
  extra?: ReactNode;
}) {
  const facts = [
    { term: "Who uses it", items: [product.who] },
    { term: "How it connects", items: product.connects },
    { term: "What you need", items: product.needs },
    { term: "Not built yet", items: product.notYet }
  ];

  return (
    <PageFrame>
      <PageHero
        trail={[
          { name: "Home", path: "/" },
          { name: "Product", path: "/product" },
          { name: product.name, path: product.href }
        ]}
        eyebrow="Product"
        title={titleWithAccent(title)}
        lede={product.line}
        actions={
          <>
            <Link href="/contact" className={primaryButton}>
              Ask about your store
            </Link>
            <a href={product.guide} className={secondaryButton}>
              {product.name} guide
            </a>
          </>
        }
        aside={aside}
      />

      <Section id="jobs" title="What it does" tone="wash">
        <CheckList items={product.jobs} className="grid gap-x-12 md:grid-cols-2 md:space-y-0 md:gap-y-4" />
      </Section>

      {extra}

      <Section id="details" title="Before you start" tone="white">
        <dl className="grid gap-x-12 gap-y-10 md:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.term} className="border-t border-[var(--line-strong)] pt-4">
              <dt className="text-[19px] font-extrabold">{fact.term}</dt>
              <dd className="mt-3">
                <ul className="space-y-2 text-[17px] leading-relaxed text-[var(--muted)]">
                  {fact.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <OtherApps current={product.key} />
    </PageFrame>
  );
}

/** The other three apps, so no product page is a dead end. */
export function OtherApps({ current }: { current: ProductEntry["key"] }) {
  return (
    <section aria-labelledby="other-apps-heading" className="bg-[var(--wash)]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="other-apps-heading" className="sd-h3">
          The other StoreDesk apps
        </h2>
        <ul className="mt-6 grid gap-x-8 border-t border-[var(--line)] md:grid-cols-3">
          {PRODUCT_ORDER.filter((key) => key !== current).map((key) => {
            const other = PRODUCTS[key];
            return (
              <li key={key} className="border-b border-[var(--line)]">
                <Link href={other.href} className="group flex min-h-11 items-start justify-between gap-3 py-5">
                  <span>
                    <span className="block text-[18px] font-extrabold group-hover:text-[var(--blue-ink)]">{other.name}</span>
                    <span className="mt-1 block text-[16px] leading-snug text-[var(--muted)]">{other.line}</span>
                  </span>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[var(--blue-ink)]" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-8 text-[17px]">
          <Link href="/product" className="sd-link">
            All four apps on one page
          </Link>
        </p>
      </div>
    </section>
  );
}
