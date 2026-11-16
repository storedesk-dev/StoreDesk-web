import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  HardDrive,
  KeyRound,
  Monitor,
  Percent,
  ScanLine,
  Send,
  Server,
  Smartphone,
  Ticket,
  TrendingUp,
  WifiOff,
  type LucideIcon
} from "lucide-react";
import { GooglePlayIcon, WindowsIcon } from "@/components/BrandIcons";
import { MobileScreens } from "@/components/MobileScreens";
import { Packages } from "@/components/Packages";
import { FloatCard, PageFrame, PhoneShot, primaryButton, secondaryButton } from "@/components/PageHero";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { pageMetadata } from "@/lib/metadata";
import { PLANS, PRODUCT_NAV, SITE } from "@/lib/site";

export const metadata = pageMetadata({
  title: "StoreDesk: back-office software for convenience stores",
  description: SITE.summary,
  path: "/",
  absoluteTitle: true
});

/**
 * The home page. Server-rendered; the only client code is the header's menu and the phone screens.
 *
 * The hero is the brand's: the promise with its key phrase in the blue-to-green, three proof points,
 * Verifone and the downloads, and the real phone app with two floating cards saying what it is for.
 * Every section below is a job a store owner already does by hand, as cards with icon tiles.
 */

const PROOF_POINTS = [
  "See every supplier's price on one item",
  "Scan a shelf tag and get the margin",
  "File your Georgia ST-3 without retyping it"
];

const JOB_ICONS: LucideIcon[] = [TrendingUp, Send, ScanLine, Percent, Ticket];
const FACT_ICONS: LucideIcon[] = [HardDrive, WifiOff, KeyRound];
const APP_ICONS: Record<string, LucideIcon> = {
  "/product/desktop": Monitor,
  "/product/mobile": Smartphone,
  "/product/service": Server,
  "/product/lottery": Ticket
};

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
      {/* Hero: grid ground, the promise, proof, Verifone and the downloads; the phone app on the right. */}
      <section className="sd-hero-grid overflow-hidden border-b border-[var(--line)]">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 pb-20 pt-12 sm:px-6 md:pt-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center lg:gap-10 lg:pb-24">
          <div className="sd-enter min-w-0">
            <p className="sd-eyebrow">For convenience stores and gas stations</p>
            <h1 className="mt-4 text-[clamp(2.5rem,5vw,4rem)] font-extrabold leading-[1.03] tracking-[-0.045em]">
              Take control of your <em className="sd-grad">convenience store margins.</em>
            </h1>
            <p className="sd-lede mt-6 !max-w-[36rem] !text-[clamp(1.1rem,1.4vw,1.3rem)]">
              StoreDesk runs on your back-office PC and reads your Verifone Commander. See what every supplier charges, the
              margin on every item and your fuel prices, and let staff scan barcodes anywhere on the floor.
            </p>
            <ul className="mt-6 space-y-2.5">
              {PROOF_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-2.5 text-[17px] font-semibold">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--green)]" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-[rgba(14,67,216,0.12)] bg-white/90 px-4 py-2.5 text-[15.5px] font-semibold shadow-[var(--shadow-card)] xl:whitespace-nowrap">
              <HardDrive className="h-4 w-4 text-[var(--blue)]" aria-hidden />
              Your data stays in your store
              <span className="text-[var(--muted)]" aria-hidden>
                ·
              </span>
              Keeps working when the internet is down
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <VerifoneBadge />
              <Link href="/download" className="sd-card group inline-flex min-h-14 items-center gap-3 !rounded-2xl px-4 py-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0078D4] text-white">
                  <WindowsIcon className="h-4 w-4" />
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--line)] bg-white">
                  <GooglePlayIcon className="h-4 w-4" />
                </span>
                <span className="text-[16px] font-extrabold">Download</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/how-it-works" className={primaryButton}>
                How it works
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/contact" className={secondaryButton}>
                Contact us
              </Link>
            </div>
            <p className="mt-5 text-[15.5px] text-[var(--muted)]">
              Work at a store that uses StoreDesk?{" "}
              <Link href="/download" className="sd-link">
                Get the phone app
              </Link>
            </p>
          </div>

          <div className="sd-enter-3 relative mx-auto w-full max-w-[460px] min-w-0 py-6">
            <div className="sd-glow relative mx-auto w-[min(330px,80%)]">
              <PhoneShot
                src="/screenshots/phone-dashboard.webp"
                alt="StoreDesk Mobile dashboard for the demo store: today's sales, inside sales, high- and low-tax sales, sales tax, fuel sales and gallons, cash expected"
                sizes="330px"
                priority
              />
            </div>
            <FloatCard
              icon={<ScanLine className="h-5 w-5" aria-hidden />}
              label="On the floor"
              text="Scan a shelf tag"
              tone="green"
              className="sd-bob absolute left-0 top-[14%] hidden sm:flex"
            />
            <FloatCard
              icon={<BarChart3 className="h-5 w-5" aria-hidden />}
              label="From the register"
              text="Today's sales, live"
              className="sd-bob-slow absolute bottom-[12%] right-0 hidden sm:flex"
            />
          </div>
        </div>
      </section>

      {/* The jobs. A list with rules, not a grid of identical cards. */}
      <section aria-labelledby="jobs-heading" className="sd-band-green border-b border-[var(--line)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <div className="lg:sticky lg:top-28">
              <p className="sd-eyebrow">What it does</p>
              <h2 id="jobs-heading" className="sd-h2 mt-3">
                The back-office jobs you <em className="sd-grad">do by hand now</em>
              </h2>
            </div>
          </div>
          <ol className="space-y-4">
            {JOBS.map((job, index) => {
              const Icon = JOB_ICONS[index];
              return (
                <li key={job.title} className="sd-card sd-card-link flex gap-5 p-6">
                  <span className="sd-icon-tile">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="sd-h3">{job.title}</h3>
                    <p className="mt-2 max-w-2xl text-[17px] leading-relaxed text-[var(--muted)]">{job.body}</p>
                    <Link href={job.href} className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[16px] font-bold text-[var(--blue-ink)] hover:underline">
                      {job.link}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* StoreDesk Mobile, screen by screen. */}
      <section aria-labelledby="phone-heading" className="sd-band-blue border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <p className="sd-eyebrow">StoreDesk Mobile</p>
          <h2 id="phone-heading" className="sd-h2 mt-3 max-w-3xl">
            The same store <em className="sd-grad">on your phone</em>
          </h2>
          <p className="sd-lede mt-4">Real screens from StoreDesk Mobile on Android, running against a demo store.</p>
          <div className="mt-12">
            <MobileScreens />
          </div>
        </div>
      </section>

      {/* Where things live. Three plain facts in a definition list. */}
      <section aria-labelledby="facts-heading" className="sd-band-green border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <p className="sd-eyebrow">Where it runs</p>
          <h2 id="facts-heading" className="sd-h2 mt-3 max-w-3xl">
            It runs in your store, <em className="sd-grad">on your PC</em>
          </h2>
          <dl className="mt-10 grid gap-5 md:grid-cols-3">
            {FACTS.map((fact, index) => {
              const Icon = FACT_ICONS[index];
              return (
                <div key={fact.term} className="sd-card p-6">
                  <span className="sd-icon-tile">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <dt className="mt-5 text-[19px] font-extrabold tracking-[-0.01em]">{fact.term}</dt>
                  <dd className="mt-2 text-[17px] leading-relaxed text-[var(--muted)]">{fact.detail}</dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-10 text-[17px]">
            <Link href="/how-it-works" className="sd-link">
              What keeps working when the internet goes down
            </Link>
          </p>
        </div>
      </section>

      {/* The four apps, as a directory into the product section. */}
      <section aria-labelledby="apps-heading" className="sd-band-blue border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <p className="sd-eyebrow">The apps</p>
          <h2 id="apps-heading" className="sd-h2 mt-3 max-w-3xl">
            Four apps. <em className="sd-grad">Back office, lottery, or both.</em>
          </h2>
          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {PRODUCT_NAV.slice(1).map((item) => {
              const Icon = APP_ICONS[item.href] ?? Monitor;
              return (
                <li key={item.href}>
                  <Link href={item.href} className="sd-card group flex min-h-11 items-center gap-5 p-6">
                    <span className="sd-icon-tile">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[20px] font-extrabold tracking-[-0.015em] group-hover:text-[var(--blue-ink)]">{item.label}</span>
                      <span className="mt-1 block text-[17px] text-[var(--muted)]">{item.line}</span>
                    </span>
                    <ArrowRight className="h-5 w-5 shrink-0 text-[var(--blue-ink)] transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Packages: what a store can buy. */}
      <section id="packages" aria-labelledby="packages-heading" className="sd-band-green border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <p className="sd-eyebrow">Packages</p>
          <h2 id="packages-heading" className="sd-h2 mt-3 max-w-3xl">
            Pick what your store <em className="sd-grad">needs</em>
          </h2>
          <p className="sd-lede mt-4">One licence per store. The back office, the lottery counter, or both. We agree the price with each store.</p>
          <Packages className="mt-10" />
        </div>
      </section>

      {/* Close: what happens next, and one action. */}
      <section aria-labelledby="start-heading" className="sd-band-mix">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-end md:justify-between md:py-20">
          <div className="max-w-2xl">
            <h2 id="start-heading" className="sd-h2">
              Set up in about an hour, <em className="sd-grad">on the PC you already have</em>
            </h2>
            <p className="sd-lede mt-4">
              We set up your store and email you a setup key. You install StoreDesk, connect the register and let the
              price book import.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/download" className={primaryButton}>
              See the setup steps
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/contact" className={secondaryButton}>
              Ask about your store
            </Link>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
