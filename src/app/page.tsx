import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MobileScreens } from "@/components/MobileScreens";
import { PageFrame, PhoneShot, Screenshot, primaryButton, textLink } from "@/components/PageHero";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { pageMetadata } from "@/lib/metadata";
import { DOCS, PLANS, PRODUCT_NAV, SITE } from "@/lib/site";

export const metadata = pageMetadata({
  title: "StoreDesk: back-office software for convenience stores",
  description: SITE.summary,
  path: "/",
  absoluteTitle: true
});

/**
 * The home page. Server-rendered; the only client code is the header's menu and the phone screens.
 *
 * The hero is the product itself: the real desktop dashboard on the navy stage it uses, with a
 * phone screen over its corner. Every line below is a job a store owner already does by hand.
 */

/** What an owner does with it, in the order they would ask. Each line is true today. */
const JOBS = [
  {
    title: "See what you make on every item",
    body: "Enter what each supplier charges by the case. StoreDesk works out the cost of one, puts the cheapest first and shows the margin next to the shelf price.",
    href: "/product/desktop",
    link: "StoreDesk Desktop"
  },
  {
    title: "Change a price and send it to the register",
    body: "One item at a time. StoreDesk checks the item first, sends only the fields you changed, then reads it back from the register. Deals and fuel prices are still changed on the register itself.",
    href: "/product#register",
    link: "What it reads and sends"
  },
  {
    title: "Check a price on the shop floor",
    body: "Scan a shelf tag with an Android phone: shelf price, what you paid, margin and the cheapest supplier.",
    href: "/product/mobile",
    link: "StoreDesk Mobile"
  },
  {
    title: "Get the sales tax figures without retyping",
    body: "The Georgia ST-3 worked out from your register sales, as a file you upload to the Georgia Tax Center yourself.",
    href: "/product/desktop#jobs",
    link: "Sales tax"
  },
  {
    title: "Close the lottery shift by scanner",
    body: "Scan the ticket showing in each box. StoreDesk Lottery works out what sold and what the drawer owes.",
    href: "/product/lottery",
    link: "StoreDesk Lottery"
  }
];

/** Facts about where things live. Plain statements, each one checked against the product. */
const FACTS = [
  {
    term: "Your store data stays in the store",
    detail: "Price book, supplier costs and sales history live on the back-office PC. Our account holds your store, its licence and which PC is connected."
  },
  {
    term: "The internet can go down",
    detail: `The register and the PC talk over your store network. Staff still sign in: passwords are checked on the PC, and a session lasts ${PLANS.offlineSessionHours} hours.`
  },
  {
    term: "One licence per store",
    detail: "Granted by us for a term we agree with you. Ask, and we tell you the price."
  }
];

export default function HomePage() {
  return (
    <PageFrame>
      {/* Hero: the one dark band on the page, because the screenshot is the app's own dark theme. */}
      <section className="sd-stage overflow-hidden">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:pb-20">
          <div className="min-w-0">
            <h1 className="sd-h1 text-white">Know what you make on every item in the store.</h1>
            <p className="mt-5 max-w-xl text-[19px] leading-relaxed text-[var(--stage-muted)]">
              StoreDesk reads your Verifone Commander, puts each supplier&rsquo;s cost next to the shelf price, and runs
              on the PC in your back office.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/contact" className={primaryButton}>
                Ask about your store
              </Link>
              <Link
                href="/product"
                className="inline-flex min-h-12 items-center gap-1.5 text-[16px] font-bold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white"
              >
                See what it does
              </Link>
            </div>
            <div className="mt-10">
              <VerifoneBadge />
            </div>
          </div>

          <div className="relative min-w-0 pb-10 sm:pb-0 sm:pr-16">
            <Screenshot
              src="/screenshots/desktop-dashboard.png"
              alt="StoreDesk Desktop dashboard for a demo store: today's sales, tax, fuel gallons, lottery net and cash expected, with sales by department"
              sizes="(min-width: 1024px) 640px, 100vw"
              priority
              className="!bg-[var(--stage-raised)]"
            />
            <PhoneShot
              src="/screenshots/mobile-app-4.jpeg"
              alt="StoreDesk Mobile price book on an Android phone"
              sizes="150px"
              className="absolute -bottom-2 right-0 w-[120px] sm:-bottom-10 sm:w-[150px]"
            />
          </div>
        </div>
      </section>

      {/* The jobs. A list with rules, not a grid of identical cards. */}
      <section aria-labelledby="jobs-heading" className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h2 id="jobs-heading" className="sd-h2 lg:sticky lg:top-28">
              The back-office jobs you do by hand now
            </h2>
          </div>
          <ol className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {JOBS.map((job) => (
              <li key={job.title} className="py-7">
                <h3 className="sd-h3">{job.title}</h3>
                <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-[var(--muted)]">{job.body}</p>
                <Link href={job.href} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[16px] font-bold text-[var(--blue-ink)] hover:underline">
                  {job.link}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* StoreDesk Mobile, screen by screen. */}
      <section aria-labelledby="phone-heading" className="border-b border-[var(--line)] bg-[var(--wash)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <h2 id="phone-heading" className="sd-h2 max-w-3xl">
            The same store on your phone
          </h2>
          <p className="sd-lede mt-4">Real screens from StoreDesk Mobile on Android, running against a demo store.</p>
          <div className="mt-12">
            <MobileScreens />
          </div>
        </div>
      </section>

      {/* Where things live. Three plain facts in a definition list. */}
      <section aria-labelledby="facts-heading" className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <h2 id="facts-heading" className="sd-h2 max-w-3xl">
            It runs in your store, on your PC
          </h2>
          <dl className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-3">
            {FACTS.map((fact) => (
              <div key={fact.term} className="border-t-[3px] border-[var(--green)] pt-4">
                <dt className="text-[19px] font-extrabold tracking-[-0.01em]">{fact.term}</dt>
                <dd className="mt-2 text-[17px] leading-relaxed text-[var(--muted)]">{fact.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-10 text-[17px]">
            <Link href="/how-it-works" className="sd-link">
              What keeps working when the internet goes down
            </Link>
          </p>
        </div>
      </section>

      {/* The four apps, as a directory into the product section. */}
      <section aria-labelledby="apps-heading" className="border-b border-[var(--line)] bg-[var(--wash)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <h2 id="apps-heading" className="sd-h2 max-w-3xl">
            Four apps. Lottery is optional.
          </h2>
          <ul className="mt-10 grid border-t border-[var(--line)] md:grid-cols-2">
            {PRODUCT_NAV.slice(1).map((item) => (
              <li key={item.href} className="border-b border-[var(--line)] md:odd:border-r md:odd:pr-8 md:even:pl-8">
                <Link href={item.href} className="group flex min-h-11 items-center justify-between gap-4 py-6">
                  <span>
                    <span className="block text-[20px] font-extrabold tracking-[-0.015em] group-hover:text-[var(--blue-ink)]">{item.label}</span>
                    <span className="mt-1 block text-[17px] text-[var(--muted)]">{item.line}</span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-[var(--blue-ink)]" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Close: what happens next, and one action. */}
      <section aria-labelledby="start-heading" className="bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-end md:justify-between md:py-20">
          <div className="max-w-2xl">
            <h2 id="start-heading" className="sd-h2">
              Set up in an afternoon, on the PC you already have
            </h2>
            <p className="sd-lede mt-4">
              We set up your store and email you a setup key. You install StoreDesk, connect the register and let the
              price book import.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/contact" className={primaryButton}>
              Ask about your store
            </Link>
            <a href={DOCS.install} className={textLink}>
              Read the setup guide
            </a>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
