import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageFrame, PageHero, Section, primaryButton, textLink } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";
import { DOCS } from "@/lib/site";
import { PRODUCTS, PRODUCT_ORDER } from "../product/products";
import { OutageSimulator } from "./OutageSimulator";

export const metadata = pageMetadata({
  title: "How StoreDesk works: setup, and the internet going down",
  description:
    "Install on the back-office PC, connect your Verifone Commander, add what your suppliers charge, then the phones. And what keeps working when the internet goes down.",
  path: "/how-it-works",
  absoluteTitle: true
});

/**
 * The four stages of a first setup, in order. Not a copy of the screens: the guide walks each one
 * screen by screen, so this says what each stage is for, roughly how long it takes, and links there.
 */
const STEPS = [
  {
    title: "Install on the back-office PC",
    outcome:
      "Run the installer and paste the setup key from your email. The key works until it is used; StoreDesk then makes a new one, which an admin reads on the store PC to set up a replacement.",
    time: "About 10 minutes",
    href: DOCS.install
  },
  {
    title: "Connect your Commander",
    outcome: "Give it the register's address and your Commander login. The price book imports itself: ten thousand items in a few minutes.",
    time: "About 15 minutes",
    href: DOCS.connectRegister
  },
  {
    title: "Add what you pay your suppliers",
    outcome: "Enter case or pack costs as invoices come in. StoreDesk works out the cost of one, so two suppliers on the same item compare fairly.",
    time: "As invoices arrive",
    href: DOCS.topic("page.vendors")
  },
  {
    title: "Give your staff the phone app",
    outcome: "Staff install StoreDesk Mobile from Google Play and sign in with the account you made them. You choose which screens each person opens.",
    time: "A few minutes each",
    href: DOCS.mobileSetup
  }
];

export default function HowItWorksPage() {
  return (
    <PageFrame>
      <PageHero
        title="Set up in an afternoon, on hardware you already own"
        lede="Four steps, on the back-office PC and your phones. Nothing to rewire at the till. Each step links to the guide, which walks it screen by screen."
        actions={
          <>
            <Link href="/contact" className={primaryButton}>
              Ask for a setup key
            </Link>
            <Link href="/download" className={textLink}>
              Download
            </Link>
          </>
        }
        aside={
          <ol className="divide-y divide-[var(--line)] rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--wash)]">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <a href={step.href} className="group flex gap-4 p-5 hover:bg-white">
                  <span
                    className="sd-num flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[16px] font-bold text-white"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[18px] font-extrabold group-hover:text-[var(--blue-ink)] group-hover:underline">{step.title}</span>
                    <span className="sd-num mt-0.5 block text-[15px] font-semibold text-[var(--green-ink)]">{step.time}</span>
                    <span className="mt-1 block text-[16px] leading-snug text-[var(--muted)]">{step.outcome}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        }
      />

      <Section
        id="offline"
        title="Switch the internet off and see what keeps working"
        lede="The register and the back-office PC talk over your store network, so the parts that run the store do not need the line."
        tone="wash"
      >
        <OutageSimulator />
      </Section>

      <Section
        id="parts"
        title="One PC does the work"
        lede="StoreDesk Service on the back-office PC is the only part that has to be running for the store to work. The rest connect to it."
        tone="white"
      >
        <ul className="grid border-t border-[var(--line)] md:grid-cols-2">
          {PRODUCT_ORDER.map((key) => {
            const product = PRODUCTS[key];
            return (
              <li key={key} className="border-b border-[var(--line)] md:odd:border-r md:odd:pr-8 md:even:pl-8">
                <Link href={product.href} className="group flex min-h-11 items-start justify-between gap-4 py-6">
                  <span>
                    <span className="block text-[20px] font-extrabold group-hover:text-[var(--blue-ink)]">{product.name}</span>
                    <span className="mt-1 block text-[17px] text-[var(--muted)]">{product.line}</span>
                  </span>
                  <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[var(--blue-ink)]" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-8 max-w-2xl text-[17px] text-[var(--muted)]">
          Your StoreDesk account holds your store, its licence, its PC and its people. Your sales figures stay in the store.
        </p>
      </Section>
    </PageFrame>
  );
}
