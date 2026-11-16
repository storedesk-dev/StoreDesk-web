import Link from "next/link";
import { ArrowRight, Check, Send, X } from "lucide-react";
import { JsonLd, PageFrame, PageHero, Screenshot, Section, primaryButton, textLink } from "@/components/PageHero";
import { FAQ, faqJsonLd } from "@/lib/faq";
import { SITE_URL, pageMetadata } from "@/lib/metadata";
import { DOCS, PLANS } from "@/lib/site";
import { PRODUCTS, PRODUCT_ORDER } from "./products";

export const metadata = pageMetadata({
  title: "StoreDesk Desktop, Mobile, Service and Lottery",
  absoluteTitle: true,
  description:
    "What each StoreDesk app does, what it reads from and sends to your Verifone Commander, and what keeps working with the internet down.",
  path: "/product"
});

const PAGE_URL = `${SITE_URL}/product`;

/** In-page links, wrapping onto a second line on a phone. */
const ON_THIS_PAGE = [
  { href: "#apps", label: "The four apps" },
  { href: "#register", label: "Your register" },
  { href: "#offline", label: "Internet down" },
  { href: "#questions", label: "Questions" }
];

const READS = [
  "The PLU list, prices and departments",
  "Daily, shift and monthly sales reports",
  "Single transactions, for the sales history",
  "Deals and fuel prices"
];
/** A person starts each send (Register Changes, or Save and send on the phone). */
const ON_REQUEST = [
  "An item change you saved: price, details or a new item",
  "Checked first, only the changed fields sent, then read back"
];
/** True whatever the settings say: StoreDesk has no way to do any of these. */
const NEVER = ["Edit, void or refund a sale", "Touch card processing or the pumps", "Send anything on its own, without a person"];

const OFFLINE = [
  { what: "The register and the store PC", state: "Keep working. They talk over your store network." },
  { what: "StoreDesk Desktop", state: "Keeps working. It runs on the same PC." },
  { what: "Signing in", state: `Keeps working. Passwords are checked on the store PC, and a session lasts ${PLANS.offlineSessionHours} hours.` },
  { what: "StoreDesk Mobile away from the store", state: "Waits for the line, unless an admin has turned on local network access for the store Wi-Fi." },
  { what: "The Google Sheet", state: "Writes the days it missed once the line is back." }
];

export default function ProductPage() {
  return (
    <>
      {/* The FAQ is emitted from the same array the page renders, so the two cannot drift. */}
      <JsonLd data={{ "@context": "https://schema.org", ...faqJsonLd(PAGE_URL) }} />
      <PageFrame>
        <PageHero
          trail={[
            { name: "Home", path: "/" },
            { name: "Product", path: "/product" }
          ]}
          title="Your back office, on the PC you already have"
          lede="StoreDesk Desktop and Service on the back-office PC. StoreDesk Mobile on staff phones. StoreDesk Lottery at the ticket counter, if you want it. Your store data stays on the store PC."
          actions={
            <>
              <Link href="/contact" className={primaryButton}>
                Ask about your store
              </Link>
              <Link href="/how-it-works" className={textLink}>
                How setup goes
              </Link>
            </>
          }
          aside={
            <Screenshot
              src="/screenshots/desktop-dashboard.png"
              alt="StoreDesk Desktop dashboard for a demo store: today's sales, tax, fuel gallons, lottery net and cash expected"
              priority
              caption="StoreDesk Desktop, in the demo store."
            />
          }
        />

        <nav aria-label="On this page" className="border-b border-[var(--line)] bg-white">
          <ul className="mx-auto flex max-w-6xl flex-wrap gap-x-6 px-4 sm:px-6">
            {ON_THIS_PAGE.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="inline-flex min-h-12 items-center text-[16px] font-semibold text-[var(--blue-ink)] hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Section id="apps" title="Four apps, each with one job" tone="wash">
          <ul className="border-t border-[var(--line-strong)]">
            {PRODUCT_ORDER.map((key) => {
              const product = PRODUCTS[key];
              return (
                // The id keeps the old /product#desktop style links landing on the right app.
                <li key={key} id={key} className="grid gap-6 border-b border-[var(--line-strong)] py-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div>
                    <h3 className="sd-h3 text-[24px]">{product.name}</h3>
                    <p className="mt-2 text-[17px] leading-relaxed text-[var(--muted)]">{product.line}</p>
                    <Link href={product.href} className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[16px] font-bold text-[var(--blue-ink)] hover:underline">
                      All about {product.name}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                  <ul className="space-y-2.5">
                    {product.jobs.slice(0, 4).map((job) => (
                      <li key={job} className="flex gap-3 text-[17px] leading-snug">
                        <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--green-ink)]" aria-hidden />
                        <span className="min-w-0">{job}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section
          id="register"
          title="It reads your register. It sends only what a person sends."
          lede="Sending to the register is off until you turn it on for a role, and every send is started and confirmed by a person. Deals and fuel prices are still changed on the register."
          tone="white"
        >
          <div className="grid gap-10 md:grid-cols-3">
            <div className="border-t-[3px] border-[var(--green)] pt-4">
              <h3 className="sd-h3">StoreDesk reads</h3>
              <ul className="mt-4 space-y-3">
                {READS.map((r) => (
                  <li key={r} className="flex gap-3 text-[17px] leading-snug">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--green-ink)]" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t-[3px] border-[var(--blue)] pt-4">
              <h3 className="sd-h3">Only when you send it</h3>
              <ul className="mt-4 space-y-3">
                {ON_REQUEST.map((r) => (
                  <li key={r} className="flex gap-3 text-[17px] leading-snug">
                    <Send className="mt-0.5 h-5 w-5 shrink-0 text-[var(--blue-ink)]" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
              <a href={DOCS.topic("page.registerChanges")} className="mt-4 inline-flex min-h-11 items-center text-[16px] font-bold text-[var(--blue-ink)] hover:underline">
                How sending to the register works
              </a>
            </div>
            <div className="border-t-[3px] border-[var(--red-ink)] pt-4">
              <h3 className="sd-h3">StoreDesk never</h3>
              <ul className="mt-4 space-y-3">
                {NEVER.map((r) => (
                  <li key={r} className="flex gap-3 text-[17px] leading-snug">
                    <X className="mt-0.5 h-5 w-5 shrink-0 text-[var(--red-ink)]" aria-hidden />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section
          id="offline"
          title="When the internet goes down, the store keeps trading"
          lede="The register and the store PC talk over your own store network. After a restart, StoreDesk Service starts itself and catches up."
          tone="wash"
        >
          <dl className="divide-y divide-[var(--line)] border-y border-[var(--line)] bg-white">
            {OFFLINE.map((row) => (
              <div key={row.what} className="grid gap-1 px-5 py-4 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:gap-6">
                <dt className="text-[17px] font-bold">{row.what}</dt>
                <dd className="text-[17px] text-[var(--muted)]">{row.state}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-[17px]">
            <Link href="/how-it-works#offline" className="sd-link">
              Try it: switch the internet off
            </Link>
          </p>
        </Section>

        <Section id="questions" title="What stores ask before they start" tone="white" width="narrow">
          <dl className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {FAQ.map((entry) => (
              <div key={entry.question} className="py-6">
                <dt className="text-[19px] font-extrabold tracking-[-0.01em]">{entry.question}</dt>
                <dd className="mt-2 text-[17px] leading-relaxed text-[var(--muted)]">
                  {entry.answer}
                  {entry.href ? (
                    <>
                      {" "}
                      <a href={entry.href} className="whitespace-nowrap font-bold text-[var(--blue-ink)] hover:underline">
                        More on this<span className="sr-only">: {entry.question}</span>
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      </PageFrame>
    </>
  );
}
