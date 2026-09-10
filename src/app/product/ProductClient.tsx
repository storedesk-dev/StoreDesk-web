"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  FileSpreadsheet,
  Receipt,
  ScanLine,
  Tags,
  WifiOff
} from "lucide-react";
import { MarketingShell } from "@/components/MarketingShell";
import { PLANS } from "@/lib/site";

/**
 * What StoreDesk does.
 *
 * Every claim on this page maps to shipped code. Where a number appears it
 * comes from `@/lib/site`, which is checked against the control plane.
 */

const FEATURES: Array<{
  icon: ReactNode;
  title: string;
  body: string;
  detail: string;
}> = [
  {
    icon: <BookOpen className="h-5 w-5" />,
    title: "Price book",
    body: "Every PLU on your register, searchable in one list — by barcode, name or department.",
    detail:
      "StoreDesk pulls the full PLU list from the Commander and only writes back the items that actually changed, so a refresh on a ten-thousand-item catalogue is quick and quiet."
  },
  {
    icon: <Tags className="h-5 w-5" />,
    title: "Vendor costs side by side",
    body: "What each supplier charges for the same item, cheapest first, with the margin worked out.",
    detail:
      "Costs are entered per case or per pack and normalised to a price per unit, so a 24-pack from one supplier and a 12-pack from another are actually comparable."
  },
  {
    icon: <ScanLine className="h-5 w-5" />,
    title: "Scan on the floor",
    body: "Point your phone at a barcode and see the shelf price, what you paid, and the margin.",
    detail:
      "Leading zeros and EAN/UPC variants are normalised before lookup, so a code scanned from a shelf tag matches the same item a code typed at the desk does."
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Sales from the register",
    body: "Daily, shift and monthly totals read straight from the Commander — no rekeying.",
    detail:
      "Department splits, fuel, lottery, card and cash come across as the register recorded them, alongside individual transactions."
  },
  {
    icon: <Receipt className="h-5 w-5" />,
    title: "Georgia ST-3 sales tax",
    body: "Your monthly return generated as a filing-ready XML file for the Georgia Tax Center.",
    detail:
      "Taxable and exempt sales, jurisdiction distributions and vendor's compensation are computed from the register data you already have. Review it on screen before you file."
  },
  {
    icon: <FileSpreadsheet className="h-5 w-5" />,
    title: "Your own Google Sheet",
    body: "Daily sales written to a spreadsheet you own, on a schedule or on demand.",
    detail:
      "Map the columns once. If your accountant already has a sheet they like, StoreDesk writes into that one rather than making you adopt a new format."
  }
];

export function ProductClient() {
  const reduceMotion = useReducedMotion();

  return (
    <MarketingShell
      eyebrow="What it does"
      title="Everything the back office needs, on the PC that is already there"
      lede="StoreDesk reads your register, keeps your price book straight, and tells you what you are actually making on each item. No new hardware, no monthly outage when the internet drops."
    >
      <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, index) => (
          <motion.article
            key={feature.title}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: reduceMotion ? 0 : 0.4,
              delay: reduceMotion ? 0 : Math.min(index, 3) * 0.05,
              ease: [0.22, 1, 0.36, 1]
            }}
            className="group flex flex-col bg-white p-7 transition-colors hover:bg-[#FBFCFD]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A63F4]/8 text-[#1A63F4]">
              {feature.icon}
            </span>
            <h2 className="mt-4 text-[17px] font-semibold tracking-tight">{feature.title}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--foreground)]">
              {feature.body}
            </p>
            <p className="mt-3 border-t border-[var(--border)] pt-3 text-[13.5px] leading-relaxed text-[var(--muted)]">
              {feature.detail}
            </p>
          </motion.article>
        ))}
      </div>

      {/* The one thing that genuinely separates this from a cloud back office. */}
      <section className="mt-16 overflow-hidden rounded-2xl border border-[var(--border)] bg-[#17202A] text-white">
        <div className="grid gap-10 p-8 md:grid-cols-[1.3fr_1fr] md:p-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium">
              <WifiOff className="h-3.5 w-3.5" />
              When the line goes down
            </span>
            <h2 className="mt-5 text-[26px] font-semibold leading-tight tracking-tight md:text-[30px]">
              The register does not stop, so neither does StoreDesk
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
              The catalogue, the prices and the sales history live on your PC, not in
              somebody&apos;s data centre. Once a member of staff has signed in, the desktop
              keeps working with no internet at all for {PLANS.offlineSessionHours} hours —
              a full shift — because their sign-in is verified on your own machine rather
              than checked against a server each time.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-6 self-center md:grid-cols-1">
            <div>
              <dt className="text-[12px] uppercase tracking-[0.1em] text-white/50">
                Works offline for
              </dt>
              <dd className="mt-1 text-[28px] font-semibold tabular-nums">
                {PLANS.offlineSessionHours} hrs
              </dd>
            </div>
            <div>
              <dt className="text-[12px] uppercase tracking-[0.1em] text-white/50">
                Sales data in the cloud
              </dt>
              <dd className="mt-1 text-[28px] font-semibold">None</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-[22px] font-semibold tracking-tight">Works with your Commander</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          StoreDesk talks to a Verifone Commander over your store network and{" "}
          <strong className="font-semibold text-[var(--foreground)]">only ever reads from it</strong>.
          It does not change prices on the register, so there is nothing it can break at the
          till. The account it connects with needs view access to the PLU list and nothing
          more.
        </p>
      </section>
    </MarketingShell>
  );
}
