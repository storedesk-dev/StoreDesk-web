import Link from "next/link";
import { CheckList, PageFrame, PageHero, Screenshot, Section, primaryButton, textLink } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";
import { DOCS } from "@/lib/site";
import { OtherApps } from "../ProductDetail";
import { PRODUCTS } from "../products";

/**
 * StoreDesk Lottery.
 *
 * Every claim is checked against store-desk-lottery (src/pages, backend) and its user guide
 * (store-desk-docs/src/content/docs/lottery). Not built, so not claimed: emailed reports (said
 * as "coming soon"), the Georgia settlement statement import, lottery screens on the phone, and any
 * lottery cloud.
 */

export const metadata = pageMetadata({
  title: "StoreDesk Lottery: the ticket rack, counted by scanner",
  description:
    "Receive packs, put them out and close each shift by scanning the rack. Shift and daily reports, what to order, and the day's lottery cash sent to StoreDesk.",
  path: "/product/lottery",
  absoluteTitle: true,
  image: { path: "/product/lottery/opengraph-image", alt: "StoreDesk Lottery: the instant-ticket rack in a demo store" }
});

/** A pack's life, as the guide tells it. A real sequence, so it is numbered. */
const PACK_LIFE = [
  { name: "Received", body: "Scanned off the truck into stock." },
  { name: "On the rack", body: "Put in a box. Its count starts at the first ticket showing." },
  { name: "Counted", body: "Scanned at every shift close." },
  { name: "Sold out", body: "Leaves its box. The next pack goes in." },
  { name: "Settled", body: "Billed by the state, 21 days after it went out in Georgia." }
];

const CLOSE_STEPS = [
  "On the Rack, click Close the shift.",
  "Scan the ticket showing in each box, in any order. Each box turns green as it is counted.",
  "A box you can't scan: mark it Sold out, or leave it out with a reason.",
  "Type three numbers from the lottery terminal: net online sales, online cashes and instant cashes.",
  "Check Lottery cash, then click Close the shift. The shift report opens and the next shift starts."
];

const OWNER = [
  "Shift and daily reports, for any date range.",
  "Correct a closed day. Each correction is a new version with a reason, kept in the history.",
  "Settle the packs that are due, in one click.",
  "Best sellers, by game and by price.",
  "Which prices earn their rack space, and what to order for the next two weeks.",
  "Each role sees only its pages. One sign-in, the same as StoreDesk.",
  "An idle lock signs the counter out after the minutes you choose."
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
      "Boxes not counted, each with its reason.",
      "Print, for the paper copy."
    ]
  },
  {
    title: "Daily report",
    items: ["Instant and online sales and cashes, per day.", "Packs put out and settled, profit, and lottery cash.", "7 days, 30 days, this month, or any range."]
  },
  {
    title: "What to order",
    items: ["Best sellers, by game and by price.", "Rack advice: give a price more boxes, or fewer.", "What to order, for two weeks' cover."]
  }
];

function Steps({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, i) => (
        <li key={step} className="flex gap-4">
          <span
            className="sd-num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[16px] font-bold text-white"
            aria-hidden
          >
            {i + 1}
          </span>
          <span className="min-w-0 self-center text-[17px] leading-snug">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export default function LotteryPage() {
  const product = PRODUCTS.lottery;
  return (
    <PageFrame>
      <PageHero
        trail={[
          { name: "Home", path: "/" },
          { name: "Product", path: "/product" },
          { name: product.name, path: product.href }
        ]}
        title="StoreDesk Lottery: the ticket rack, counted by scanner"
        lede="Receive packs, put them out, and close each shift by scanning the rack. It works out what sold and what the drawer owes."
        actions={
          <>
            <Link href="/contact" className={primaryButton}>
              Ask us for StoreDesk Lottery
            </Link>
            <a href={DOCS.lottery} className={textLink}>
              Lottery guide
            </a>
          </>
        }
        aside={
          <Screenshot
            src="/screenshots/lottery-rack.png"
            alt="StoreDesk Lottery rack for a demo store: numbered boxes by ticket price, each with its game, pack number and tickets left"
            priority
            caption="The rack, in the demo store. Its own app, on the lottery counter PC."
          />
        }
      >
        <p className="mt-4 text-[17px] font-semibold">Runs on its own, or alongside StoreDesk.</p>
      </PageHero>

      <Section id="close" title="Closing a shift takes a few minutes" lede="Every scan is saved as you go, so a clerk can stop and come back." tone="wash">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0">
            <Steps steps={CLOSE_STEPS} />
            <div className="mt-10 border-t-[3px] border-[var(--green)] pt-4">
              <h3 className="sd-h3">What the drawer owes</h3>
              <p className="sd-num mt-3 rounded-[var(--radius-md)] bg-white px-4 py-3 text-[17px] font-semibold">
                instant sales &minus; instant cashes + online sales &minus; online cashes
              </p>
              <p className="mt-3 text-[16px] text-[var(--muted)]">
                Instant sales come from your scans. A blank amount is never read as zero: tick None this shift instead.
              </p>
            </div>
          </div>
          <Screenshot
            src="/screenshots/lottery-close.png"
            alt="Closing the shift in StoreDesk Lottery: the rack with counted boxes in green, the next box to scan, and instant sales so far"
            sizes="(min-width: 1024px) 560px, 100vw"
            caption="Close the shift: counted boxes turn green."
          />
        </div>
      </Section>

      <Section id="owner" title="For the owner: check the numbers, fix a day" tone="white">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <CheckList items={OWNER} />
          <div>
            <h3 className="sd-h3">A pack&rsquo;s life</h3>
            <ol className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {PACK_LIFE.map((stage, i) => (
                <li key={stage.name} className="flex gap-3 py-3">
                  <span className="sd-num w-6 shrink-0 text-[17px] font-bold text-[var(--muted)]" aria-hidden>
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[17px] font-bold">{stage.name}</span>
                    <span className="block text-[16px] text-[var(--muted)]">{stage.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      <Section id="reports" title="Shift, day and what to order" tone="wash">
        <div className="grid gap-10 md:grid-cols-3">
          {REPORTS.map((report) => (
            <div key={report.title} className="border-t border-[var(--line-strong)] pt-4">
              <h3 className="sd-h3">{report.title}</h3>
              <CheckList items={report.items} className="mt-4" />
            </div>
          ))}
        </div>
      </Section>

      <Section id="rack-setup" title="Set up the rack once, in three steps" lede="The Rack screen then looks like the counter in front of you." tone="white">
        <div className="max-w-3xl">
          <Steps steps={RACK_SETUP} />
        </div>
        <p className="mt-8 text-[17px]">
          <strong>Try the demo</strong> on the sign-in screen opens a demo store with sample data.
        </p>
      </Section>

      <Section id="storedesk" title="On its own, or with StoreDesk" tone="wash">
        <div className="grid gap-10 md:grid-cols-2">
          <div className="border-t border-[var(--line-strong)] pt-4">
            <h3 className="sd-h3">On its own</h3>
            <CheckList
              className="mt-4"
              items={[
                "Its own installer and database on the lottery PC.",
                "Packs, games and shifts stay on that PC.",
                "Someone who signed in there before can sign in again with the internet down."
              ]}
            />
          </div>
          <div className="border-t-[3px] border-[var(--blue)] pt-4">
            <h3 className="sd-h3">With StoreDesk</h3>
            <CheckList
              className="mt-4"
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

      <Section id="details" title="Before you start" tone="white">
        <dl className="grid gap-x-12 gap-y-10 md:grid-cols-2">
          <div className="border-t border-[var(--line-strong)] pt-4">
            <dt className="text-[19px] font-extrabold">What you need</dt>
            <dd className="mt-3">
              <ul className="space-y-2 text-[17px] text-[var(--muted)]">
                {product.needs.map((need) => (
                  <li key={need}>{need}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div className="border-t border-[var(--line-strong)] pt-4">
            <dt className="text-[19px] font-extrabold">Not built yet</dt>
            <dd className="mt-3">
              <ul className="space-y-2 text-[17px] text-[var(--muted)]">
                <li>Shift reports by email. Coming soon.</li>
                <li>Lottery screens on StoreDesk Mobile.</li>
              </ul>
            </dd>
          </div>
        </dl>
      </Section>

      <OtherApps current="lottery" />
    </PageFrame>
  );
}
