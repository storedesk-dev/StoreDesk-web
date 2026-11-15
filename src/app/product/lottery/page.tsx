import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Check, Mail } from "lucide-react";
import { PageFrame, PageHero, primaryButton, secondaryButton } from "@/components/PageHero";
import { pageMetadata, SITE_URL } from "@/lib/metadata";
import { jsonLdScript } from "@/lib/json-ld";
import { DOCS, contactMailto } from "@/lib/site";

/**
 * StoreDesk Lottery.
 *
 * Every claim is checked against store-desk-lottery (src/pages, backend) and its user guide
 * (store-desk-docs/src/content/docs/lottery). Not built, so not claimed: emailed reports (said
 * modestly as "coming soon"), the settlement statement import, and lottery screens on the phone.
 */

export const metadata = pageMetadata({
  title: "StoreDesk Lottery",
  description:
    "The instant-ticket rack and the shift close by scanner, with shift and daily reports. Runs on its own PC, and sends each closed day's lottery cash to StoreDesk.",
  path: "/product/lottery"
});

const PAGE_URL = `${SITE_URL}/product/lottery`;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "StoreDesk", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Product", item: `${SITE_URL}/product` },
    { "@type": "ListItem", position: 3, name: "StoreDesk Lottery", item: PAGE_URL }
  ]
};

const ON_THIS_PAGE = [
  { href: "#overview", label: "Overview" },
  { href: "#close", label: "Shift close" },
  { href: "#owner", label: "For the owner" },
  { href: "#rack-setup", label: "Rack setup" },
  { href: "#reports", label: "Reports" },
  { href: "#storedesk", label: "With StoreDesk" },
  { href: "#coming", label: "What's coming" }
];

/** A pack's life, as the guide tells it. */
const PACK_LIFE = [
  { name: "Received", body: "Scanned off the truck into stock." },
  { name: "On the rack", body: "Put in a box. The first ticket showing is where its count starts." },
  { name: "Counted", body: "Scanned at every shift close." },
  { name: "Sold out", body: "Leaves its box. The next pack goes in." },
  { name: "Settled", body: "Billed by the state, 21 days after it went out in Georgia." }
];

const OVERVIEW = [
  "Rack: every box, what is in it, and how far through each pack is.",
  "Receive packs: scan each one once. A new game fills in from the state's list.",
  "Put a pack out: pick the box, scan the pack, confirm the first ticket.",
  "Move a pack: hold it behind the counter, take it off the rack, move it to another box, or return it to the state.",
  "Packs: every pack by state, with its history: who, when, before and after.",
  "Close a shift by scanning the rack."
];

const CLOSE_STEPS = [
  "On the Rack, click Close the shift.",
  "Scan the ticket showing in each box, in any order. Each box turns green as it is counted.",
  "A box you can't scan: mark it Sold out, or leave it out with a reason.",
  "Type three numbers from the lottery terminal: net online sales, online cashes and instant cashes.",
  "Optional: type the terminal's pack counts. The report warns if they differ.",
  "Check Lottery cash, then click Close the shift. The shift report opens and the next shift starts."
];

const OWNER = [
  "Shift and daily reports, for any date range.",
  "Correct a closed day. Each correction is a new version with a reason, kept in the history.",
  "Settle the packs that are due, in one click.",
  "Best sellers, by game and by price.",
  "Which prices earn their rack space, and what to order for the next two weeks.",
  "People and roles: each role sees only its pages. One sign-in, the same as StoreDesk.",
  "An idle lock that signs the counter out after the minutes you choose."
];

const RACK_SETUP = [
  "Drag the shape of your counter: columns and rows.",
  "Fix the box numbers to match the stickers. Mark wide boxes and add spare boxes.",
  "Scan box 1 to the last. Each pack is received and put out at the ticket showing, and the first shift starts from there."
];

const REPORTS = [
  {
    title: "Shift report",
    items: [
      "Each box: pack, game, open and close ticket, count and total.",
      "Instant and online sales and cashes, lottery cash and commission.",
      "Packs put out, sold out, and left on the rack.",
      "Boxes not counted, each with its reason.",
      "Print, for the paper copy."
    ]
  },
  {
    title: "Daily report",
    items: [
      "Instant and online sales and cashes, per day.",
      "Packs put out and settled, profit, and lottery cash.",
      "7 days, 30 days, this month, or any range."
    ]
  },
  {
    title: "Analytics",
    items: [
      "Best sellers, by game and by price.",
      "Rack advice: give a price more boxes, or fewer.",
      "What to order, for two weeks' cover."
    ]
  }
];

function Section({
  id,
  title,
  eyebrow,
  lede,
  tinted,
  children
}: {
  id: string;
  title: string;
  eyebrow?: string;
  lede?: string;
  tinted?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`border-t border-[var(--border)] ${tinted ? "bg-white/60" : ""}`}
    >
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="max-w-2xl">
          {eyebrow ? <p className="sd-eyebrow">{eyebrow}</p> : null}
          <h2 id={`${id}-heading`} className="sd-h2 mt-3">
            {title}
          </h2>
          {lede ? <p className="sd-lede mt-4">{lede}</p> : null}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-[16px] leading-relaxed">
          <Check className="mt-1 h-4 w-4 shrink-0 text-[#00875F]" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={step} className="flex gap-4 rounded-2xl border border-[var(--border)] bg-white p-4 md:p-5">
          <span
            className="sd-num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1A63F4] text-[14px] font-bold text-white"
            aria-hidden
          >
            {i + 1}
          </span>
          <span className="min-w-0 self-center text-[16px] leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/** The panel beside the title: the five steps every pack goes through. */
function PackLife() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/85 shadow-[0_30px_80px_-30px_rgba(26,99,244,0.45)] backdrop-blur-xl">
      <p className="border-b border-[var(--border)] bg-gradient-to-r from-[#F5F8FF] to-[#F0FBF6] px-5 py-3 text-[13px] font-semibold text-[#17202A]">
        A pack&rsquo;s life in the app
      </p>
      <ol className="divide-y divide-[var(--border)]">
        {PACK_LIFE.map((stage, i) => (
          <li key={stage.name} className="flex gap-4 px-5 py-3.5">
            <span
              className="sd-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1A63F4]/10 text-[13px] font-bold text-[#1A63F4]"
              aria-hidden
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[15.5px] font-bold">{stage.name}</span>
              <span className="block text-[14.5px] leading-snug text-[var(--muted)]">{stage.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function LotteryPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <PageFrame>
        <PageHero
          eyebrow="StoreDesk Lottery"
          title="The lottery rack, counted by scanner"
          lede="Receive packs, put them out, and close each shift by scanning the rack. The app works out what sold and what the drawer owes."
          actions={
            <>
              <a href={contactMailto({ subject: "StoreDesk Lottery" })} className={primaryButton}>
                <Mail className="h-4 w-4" /> Ask us for it
              </a>
              <a href={DOCS.topic("product.lottery")} className={secondaryButton}>
                Lottery guide <ArrowUpRight className="h-4 w-4" />
              </a>
            </>
          }
          aside={<PackLife />}
        >
          <p className="mt-4 text-[14.5px] text-[var(--muted)]">
            Its own app and installer. Works with StoreDesk, or on its own.
          </p>
        </PageHero>

        <nav aria-label="On this page" className="border-b border-[var(--border)] bg-white/70">
          <ul className="mx-auto flex max-w-6xl flex-wrap gap-2 px-6 py-4">
            {ON_THIS_PAGE.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-white px-4 text-[14.5px] font-semibold text-[#17202A] transition-colors hover:border-[#1A63F4]/45 hover:text-[#1A63F4]"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Section
          id="overview"
          eyebrow="Overview"
          title="The rack, the packs and the close"
          lede="For the store's instant tickets. Clerks run the counter; owners check the numbers."
        >
          <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
            <div className="rounded-3xl border border-[var(--border)] bg-white p-6 md:p-7">
              <h3 className="text-[19px] font-bold tracking-tight">What it does</h3>
              <div className="mt-4">
                <Checklist items={OVERVIEW} />
              </div>
            </div>
            <div className="space-y-6 rounded-3xl border border-[var(--border)] bg-white p-6 md:p-7">
              <div>
                <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Who uses it</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed">
                  Clerks receive packs, put them out and close the shift. Owners and managers also correct days,
                  settle packs and change settings.
                </p>
              </div>
              <div>
                <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">What you need</h3>
                <ul className="mt-2 space-y-1.5 text-[15.5px] leading-relaxed">
                  <li>A Windows PC at the lottery counter: the store PC or another.</li>
                  <li>A barcode scanner.</li>
                  <li>Georgia Lottery instant tickets.</li>
                  <li>A StoreDesk sign-in for each person.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Try it first</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed">
                  <strong>Try the demo</strong> on the sign-in screen opens a demo store with sample data.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Section
          id="close"
          eyebrow="For the clerk"
          title="Closing a shift"
          lede="A few minutes at the end of each shift. Every scan is saved as you go."
          tinted
        >
          <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
            <Steps steps={CLOSE_STEPS} />
            <div className="self-start rounded-3xl bg-[#17202A] p-6 text-white md:p-7">
              <h3 className="text-[19px] font-bold tracking-tight text-white">What the drawer owes</h3>
              <p className="mt-3 text-[16px] leading-relaxed text-white/80">Lottery cash for the shift is:</p>
              <p className="mt-3 rounded-2xl bg-white/10 p-4 text-[16px] font-semibold leading-relaxed">
                instant sales &minus; instant cashes + online sales &minus; online cashes
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-white/80">
                Instant sales come from your scans. A blank amount is never read as zero: tick None this shift
                instead.
              </p>
            </div>
          </div>
        </Section>

        <Section id="owner" eyebrow="For the owner" title="Checking the numbers">
          <div className="rounded-3xl border border-[var(--border)] bg-white p-6 md:p-7">
            <Checklist items={OWNER} />
          </div>
        </Section>

        <Section
          id="rack-setup"
          eyebrow="Setting up"
          title="Rack setup, in three steps"
          lede="Draw the counter once. The Rack then looks like the one in front of you."
          tinted
        >
          <Steps steps={RACK_SETUP} />
        </Section>

        <Section id="reports" eyebrow="Reports" title="Shift, day and what to order">
          <div className="grid gap-5 md:grid-cols-3">
            {REPORTS.map((report) => (
              <div key={report.title} className="rounded-3xl border border-[var(--border)] bg-white p-6">
                <h3 className="text-[19px] font-bold tracking-tight">{report.title}</h3>
                <div className="mt-4">
                  <Checklist items={report.items} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="storedesk"
          eyebrow="How it connects"
          title="With StoreDesk, or on its own"
          tinted
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-[var(--border)] bg-white p-6 md:p-7">
              <h3 className="text-[19px] font-bold tracking-tight">On its own</h3>
              <div className="mt-4" />
              <Checklist
                items={[
                  "Its own installer and database on the lottery PC.",
                  "Packs, games and shifts stay on that PC.",
                  "Someone who signed in there before can sign in again with the internet down."
                ]}
              />
            </div>
            <div className="rounded-3xl border border-[#1A63F4]/30 bg-gradient-to-br from-[#F5F8FF] to-[#F0FBF6] p-6 md:p-7">
              <h3 className="text-[19px] font-bold tracking-tight">With StoreDesk</h3>
              <div className="mt-4" />
              <Checklist
                items={[
                  "Sign in with your StoreDesk email and password. No code or key to type.",
                  "Each closed day's lottery figures go to StoreDesk Service: sales, cashes and lottery cash.",
                  "Packs, games and names never leave the lottery PC.",
                  "A close never waits for the network. If StoreDesk is off, the days wait and send later.",
                  "StoreDesk Desktop shows the days on its Lottery page."
                ]}
              />
            </div>
          </div>
        </Section>

        <Section id="coming" eyebrow="What's coming" title="Not built yet">
          <div className="max-w-2xl rounded-3xl border border-[var(--border)] bg-white p-6 md:p-7">
            <ul className="space-y-2.5 text-[16px] leading-relaxed">
              <li>Shift reports by email. Coming soon.</li>
              <li>Lottery screens on StoreDesk Mobile are not available.</li>
            </ul>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={contactMailto({ subject: "StoreDesk Lottery" })} className={primaryButton}>
              <Mail className="h-4 w-4" /> Ask us for StoreDesk Lottery
            </a>
            <Link href="/product" className={secondaryButton}>
              All of StoreDesk <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Section>
      </PageFrame>
    </>
  );
}
