import Link from "next/link";
import { PageFrame, PageHero, Section, primaryButton, textLink } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Why we built StoreDesk",
  description:
    "Back-office software built from the counter out. Your sales data stays in your store, it keeps working when the internet does not, and it says plainly what is not built yet.",
  path: "/about",
  absoluteTitle: true
});

const RULES = [
  {
    title: "Your data stays in your store",
    body: "Sales, margins and supplier prices are the most sensitive numbers a small retailer has. Our side of StoreDesk knows your store exists and has a licence. It does not know what you sold today."
  },
  {
    title: "It works when the line is down",
    body: "Rural stores lose internet. Everything that runs the store runs on the PC in the back office."
  },
  {
    title: "The register is the source of truth",
    body: "StoreDesk reads your Commander. It sends an item change back only when a person sends it, then reads it back to check. If StoreDesk stopped tomorrow, the store would keep trading."
  },
  {
    title: "A few things that work",
    body: "Plenty of store software is sold on the length of its feature list. We would rather ship a few things that work than thirty that mostly do."
  }
];

const NOT_YET = [
  "Supplier invoices by EDI, so costs arrive without typing.",
  "Sending deal and fuel price changes to the register. Change them on the register for now.",
  "An iPhone app. StoreDesk Mobile is on Android today.",
  "StoreDesk Lottery shift reports by email. Coming soon."
];

export default function AboutPage() {
  return (
    <PageFrame>
      <PageHero
        title="Because the margin report took a Sunday afternoon"
        lede="StoreDesk started as a spreadsheet, a stack of supplier invoices, and no clear answer to which items were making money."
        actions={
          <>
            <Link href="/product" className={primaryButton}>
              See what it does
            </Link>
            <Link href="/contact" className={textLink}>
              Tell us what is missing
            </Link>
          </>
        }
      />

      <Section title="The back office ran on paper and retyping" tone="wash" width="narrow">
        <div className="max-w-2xl space-y-5 text-[18px] leading-[1.7]">
          <p>
            Reports came off the register on paper. Fuel readings came off another printout. Invoices came in a stack.
            Every week someone copied it all into a spreadsheet by hand, then checked the spreadsheet against the paper.
          </p>
          <p>
            Changing prices was its own afternoon in the Commander&rsquo;s screens. The sales tax return came from the same
            retyped numbers.
          </p>
          <p>
            So StoreDesk reads the register directly and keeps it on your own PC: the price book and what you pay for each
            item, the daily and shift reports, fuel, and the Georgia ST-3 built from data you already have.
          </p>
        </div>
      </Section>

      <Section title="Four rules the product is built around" tone="white">
        <dl className="grid gap-x-12 gap-y-10 md:grid-cols-2">
          {RULES.map((rule) => (
            <div key={rule.title} className="border-t-[3px] border-[var(--ink)] pt-4">
              <dt className="sd-h3">{rule.title}</dt>
              <dd className="mt-2 text-[17px] leading-relaxed text-[var(--muted)]">{rule.body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section
        title="Not here yet"
        lede="Everything else on this site runs in a store today. These are planned, and we list them as planned."
        tone="wash"
        width="narrow"
      >
        <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {NOT_YET.map((item) => (
            <li key={item} className="py-4 text-[17px]">
              {item}
            </li>
          ))}
        </ul>
      </Section>
    </PageFrame>
  );
}
