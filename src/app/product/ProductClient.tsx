"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  FileSpreadsheet,
  Monitor,
  Receipt,
  ScanLine,
  Smartphone,
  Tags,
  WifiOff,
  X
} from "lucide-react";
import { PageFrame, PageHero, SectionHead, primaryButton, secondaryButton } from "@/components/PageHero";
import { PLANS } from "@/lib/site";

/**
 * What StoreDesk does.
 *
 * The hero is the product's core sum — shelf price minus what you paid — as a
 * calculator a visitor can play with. Every item and figure in it is an
 * example and is labelled as one; the feature claims below map to shipped code.
 */

type Vendor = { name: string; caseCost: number; units: number };
type Item = { plu: string; name: string; dept: string; shelf: number; vendors: Vendor[] };

const EXAMPLE_ITEMS: Item[] = [
  {
    plu: "000120",
    name: "Cola, 20 oz bottle",
    dept: "Soft drinks",
    shelf: 2.49,
    vendors: [
      { name: "Peach State Wholesale", caseCost: 27.36, units: 24 },
      { name: "Hwy 41 Distributing", caseCost: 28.8, units: 24 },
      { name: "Cash & carry", caseCost: 15.48, units: 12 }
    ]
  },
  {
    plu: "000884",
    name: "Energy drink, 8.4 oz",
    dept: "Energy",
    shelf: 3.29,
    vendors: [
      { name: "Hwy 41 Distributing", caseCost: 45.12, units: 24 },
      { name: "Peach State Wholesale", caseCost: 46.8, units: 24 },
      { name: "Cash & carry", caseCost: 23.1, units: 12 }
    ]
  },
  {
    plu: "002250",
    name: "Tortilla chips, 9.25 oz",
    dept: "Snacks",
    shelf: 5.79,
    vendors: [
      { name: "Hwy 41 Distributing", caseCost: 40.8, units: 12 },
      { name: "Peach State Wholesale", caseCost: 42.0, units: 12 }
    ]
  },
  {
    plu: "003051",
    name: "Ground coffee, 30.5 oz",
    dept: "Grocery",
    shelf: 14.99,
    vendors: [
      { name: "Cash & carry", caseCost: 63.0, units: 6 },
      { name: "Peach State Wholesale", caseCost: 65.4, units: 6 }
    ]
  }
];

const money = (n: number) => `$${n.toFixed(2)}`;

function marginTone(pct: number) {
  if (pct < 20) return { text: "text-[#B54708]", bar: "bg-[#F79009]", label: "Thin" };
  if (pct < 35) return { text: "text-[#1A63F4]", bar: "bg-[#1A63F4]", label: "Fair" };
  return { text: "text-[#00875F]", bar: "bg-[#00A87B]", label: "Healthy" };
}

function MarginChecker() {
  const [itemIndex, setItemIndex] = useState(0);
  const item = EXAMPLE_ITEMS[itemIndex];
  const [price, setPrice] = useState(item.shelf);

  const vendors = useMemo(
    () =>
      item.vendors
        .map((v) => ({ ...v, unit: v.caseCost / v.units }))
        .sort((a, b) => a.unit - b.unit),
    [item]
  );
  const best = vendors[0];
  const profit = price - best.unit;
  const pct = price > 0 ? (profit / price) * 100 : 0;
  const tone = marginTone(pct);
  const changed = Math.abs(price - item.shelf) > 0.001;

  function pick(index: number) {
    setItemIndex(index);
    setPrice(EXAMPLE_ITEMS[index].shelf);
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/85 shadow-[0_30px_80px_-30px_rgba(26,99,244,0.45)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-gradient-to-r from-[#F5F8FF] to-[#F0FBF6] px-5 py-3">
        <p className="text-[13px] font-semibold text-[#17202A]">Price book · margin check</p>
        <span className="rounded-full bg-[#F79009]/12 px-2.5 py-0.5 text-[11.5px] font-semibold text-[#B54708]">
          Example items
        </span>
      </div>

      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {EXAMPLE_ITEMS.map((it, index) => {
          const active = index === itemIndex;
          return (
            <button
              key={it.plu}
              type="button"
              onClick={() => pick(index)}
              aria-pressed={active}
              className={`rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
                active
                  ? "border-[#1A63F4]/50 bg-[#1A63F4]/[0.06]"
                  : "border-[var(--border)] bg-white hover:border-[#1A63F4]/30"
              }`}
            >
              <span className="block truncate text-[14.5px] font-semibold text-[#17202A]">{it.name}</span>
              <span className="sd-num block text-[12px] text-[var(--muted)]">
                PLU {it.plu} · {it.dept}
              </span>
            </button>
          );
        })}
      </div>

      <div className="px-5 pb-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
          What each supplier charges, cheapest first
        </p>
        <ul className="mt-2 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)]">
          <AnimatePresence initial={false} mode="popLayout">
            {vendors.map((v, i) => (
              <motion.li
                key={`${item.plu}-${v.name}`}
                layout
                initial={{ x: 12 }}
                animate={{ x: 0 }}
                className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[#17202A]">
                    {v.name}
                    {i === 0 ? (
                      <span className="ml-2 rounded-full bg-[#00A87B]/12 px-2 py-0.5 text-[11px] font-semibold text-[#00875F]">
                        Cheapest
                      </span>
                    ) : null}
                  </p>
                  <p className="sd-num text-[12px] text-[var(--muted)]">
                    {money(v.caseCost)} per {v.units}
                  </p>
                </div>
                <p className="sd-num shrink-0 text-[15px] font-semibold text-[#17202A]">
                  {money(v.unit)}
                  <span className="text-[12px] font-normal text-[var(--muted)]"> /ea</span>
                </p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <div className="m-4 mt-3 rounded-2xl bg-[#17202A] p-4 text-white">
        <div className="flex items-end justify-between gap-4">
          <label htmlFor="shelf-price" className="text-[13px] text-white/70">
            Shelf price
            <span className="sd-num mt-0.5 block text-[26px] font-semibold text-white">{money(price)}</span>
          </label>
          <div className="text-right">
            <p className="text-[13px] text-white/70">Margin</p>
            <p className="sd-num text-[26px] font-semibold">
              {pct.toFixed(1)}
              <span className="text-[16px]">%</span>
            </p>
          </div>
        </div>
        <input
          id="shelf-price"
          type="range"
          min={Math.max(0.25, Math.floor(best.unit * 100) / 100)}
          max={Math.ceil(item.shelf * 1.6 * 4) / 4}
          step={0.01}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="mt-3 w-full accent-[#28C88B]"
        />
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className={`h-full rounded-full ${tone.bar}`}
            animate={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-white/75">
          <span>
            <span className="sd-num font-semibold text-white">{money(profit)}</span> on each one sold ·{" "}
            {tone.label}
          </span>
          {changed ? (
            <button
              type="button"
              onClick={() => setPrice(item.shelf)}
              className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white hover:bg-white/20"
            >
              Back to register price {money(item.shelf)}
            </button>
          ) : (
            <span>Register price</span>
          )}
        </div>
      </div>
    </div>
  );
}

type Feature = {
  key: string;
  icon: ReactNode;
  title: string;
  body: string;
  detail: string;
  where: Array<"Desktop" | "Phone">;
  visual: ReactNode;
};

function MiniTable({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
      {rows.map(([a, b, c], i) => (
        <div
          key={b}
          className={`grid grid-cols-[88px_1fr_auto] gap-3 px-3.5 py-2 text-[13px] ${i === 0 ? "bg-[#F5F8FF] font-semibold text-[var(--muted)]" : "border-t border-[var(--border)]"}`}
        >
          <span className="sd-num">{a}</span>
          <span className="truncate">{b}</span>
          <span className="sd-num text-right">{c}</span>
        </div>
      ))}
    </div>
  );
}

const WEEK = [62, 71, 58, 80, 94, 100, 77];

const FEATURES: Feature[] = [
  {
    key: "price-book",
    icon: <BookOpen className="h-5 w-5" />,
    title: "Price book",
    body: "Every PLU on your register in one searchable list — by barcode, name or department.",
    detail:
      "StoreDesk pulls the full PLU list from the Commander and only rewrites the items that changed, so refreshing a ten-thousand-item catalogue is quick and quiet.",
    where: ["Desktop", "Phone"],
    visual: (
      <MiniTable
        rows={[
          ["PLU", "Item", "Price"],
          ["000120", "Cola, 20 oz bottle", "$2.49"],
          ["000884", "Energy drink, 8.4 oz", "$3.29"],
          ["002250", "Tortilla chips, 9.25 oz", "$5.79"]
        ]}
      />
    )
  },
  {
    key: "vendor-costs",
    icon: <Tags className="h-5 w-5" />,
    title: "Supplier costs side by side",
    body: "What each supplier charges for the same item, cheapest first, with the margin worked out.",
    detail:
      "Enter costs by the case or the pack; StoreDesk turns them into a price per unit, so a 24-pack from one supplier and a 12-pack from another compare fairly.",
    where: ["Desktop", "Phone"],
    visual: (
      <div className="space-y-2.5">
        {[
          ["Peach State Wholesale", 1.14, 88],
          ["Hwy 41 Distributing", 1.2, 93],
          ["Cash & carry", 1.29, 100]
        ].map(([name, unit, w]) => (
          <div key={name as string}>
            <div className="flex justify-between text-[13px]">
              <span>{name}</span>
              <span className="sd-num font-semibold">${(unit as number).toFixed(2)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[#1A63F4]/8">
              <div className="h-2 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B]" style={{ width: `${w}%` }} />
            </div>
          </div>
        ))}
      </div>
    )
  },
  {
    key: "scan",
    icon: <ScanLine className="h-5 w-5" />,
    title: "Scan on the floor",
    body: "Point your phone at a shelf tag and see the price, what you paid and the margin.",
    detail:
      "Leading zeros and UPC/EAN variants are normalised before the lookup, so a code scanned off a shelf matches the same item as one typed at the desk.",
    where: ["Phone"],
    visual: (
      <div className="mx-auto max-w-[240px] rounded-[22px] border-4 border-[#17202A] bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#00875F]">Scanned</p>
        <p className="mt-1 text-[14px] font-semibold">Cola, 20 oz bottle</p>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
          {[
            ["Price", "$2.49"],
            ["Cost", "$1.14"],
            ["Margin", "54%"]
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-[#F5F8FF] py-1.5">
              <p className="text-[10.5px] text-[var(--muted)]">{k}</p>
              <p className="sd-num text-[13px] font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    key: "sales",
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Sales from the register",
    body: "Daily, shift and monthly totals read straight from the Commander — nothing to rekey.",
    detail:
      "Department splits, fuel, lottery, card and cash come across as the register recorded them, alongside the individual transactions.",
    where: ["Desktop", "Phone"],
    visual: (
      <div className="flex h-28 items-end gap-2">
        {WEEK.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-[#1A63F4] to-[#28C88B]"
              style={{ height: `${h}%` }}
            />
            <span className="text-[10.5px] text-[var(--muted)]">{"MTWTFSS"[i]}</span>
          </div>
        ))}
      </div>
    )
  },
  {
    key: "st3",
    icon: <Receipt className="h-5 w-5" />,
    title: "Georgia ST-3 sales tax",
    body: "Your monthly return produced as a filing-ready XML file for the Georgia Tax Center.",
    detail:
      "Taxable and exempt sales, jurisdiction distributions and vendor’s compensation are worked out from register data you already have. You review it on screen before you file.",
    where: ["Desktop"],
    visual: (
      <MiniTable
        rows={[
          ["August", "Return summary", "Amount"],
          ["", "Gross sales", "$84,210"],
          ["", "Exempt sales", "$21,905"],
          ["", "Taxable sales", "$62,305"]
        ]}
      />
    )
  },
  {
    key: "sheets",
    icon: <FileSpreadsheet className="h-5 w-5" />,
    title: "Your own Google Sheet",
    body: "Daily sales written into a spreadsheet you own, on a schedule or when you ask.",
    detail:
      "Map the columns once. If your accountant already has a sheet they like, StoreDesk writes into that one instead of making you adopt a new format.",
    where: ["Desktop"],
    visual: (
      <div className="overflow-hidden rounded-xl border border-[#00A87B]/30 bg-white text-[12.5px]">
        <div className="grid grid-cols-4 bg-[#00A87B]/10 font-semibold text-[#00875F]">
          {["Date", "Inside", "Fuel", "Total"].map((c) => (
            <span key={c} className="px-2.5 py-1.5">{c}</span>
          ))}
        </div>
        {[
          ["09/08", "3,412", "6,980", "10,392"],
          ["09/09", "3,105", "7,214", "10,319"]
        ].map((r) => (
          <div key={r[0]} className="sd-num grid grid-cols-4 border-t border-[var(--border)]">
            {r.map((c, i) => (
              <span key={i} className="px-2.5 py-1.5">{c}</span>
            ))}
          </div>
        ))}
      </div>
    )
  }
];

function FeatureExplorer() {
  const [active, setActive] = useState(FEATURES[0].key);
  const reduceMotion = useReducedMotion();
  const feature = FEATURES.find((f) => f.key === active) ?? FEATURES[0];

  return (
    <div className="mt-10 grid gap-5 lg:grid-cols-[320px_1fr]">
      <div role="tablist" aria-label="Features" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {FEATURES.map((f) => {
          const on = f.key === active;
          return (
            <button
              key={f.key}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setActive(f.key)}
              className={`relative flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                on ? "text-white" : "bg-white/70 text-[#17202A] hover:bg-white"
              }`}
            >
              {on ? (
                <motion.span
                  layoutId="feature-chip"
                  className="absolute inset-0 -z-0 rounded-2xl bg-gradient-to-r from-[#1A63F4] to-[#00A87B] shadow-[0_10px_24px_-10px_rgba(26,99,244,0.6)]"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
                />
              ) : null}
              <span className={`relative ${on ? "text-white" : "text-[#1A63F4]"}`}>{f.icon}</span>
              <span className="relative whitespace-nowrap text-[15.5px] font-semibold">{f.title}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-[28px] border border-[var(--border)] bg-white p-6 md:p-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={feature.key}
            initial={{ y: reduceMotion ? 0 : 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduceMotion ? 0 : -6, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
            className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-center"
          >
            <div>
              <h3 className="text-[24px] font-bold tracking-tight">{feature.title}</h3>
              <p className="mt-3 text-[17px] leading-relaxed text-[#17202A]">{feature.body}</p>
              <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--muted)]">{feature.detail}</p>
              <div className="mt-5 flex gap-2">
                {feature.where.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[#F5F8FF] px-3 py-1 text-[13px] font-semibold text-[#17202A]"
                  >
                    {w === "Desktop" ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                    {w}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-[#F5F8FF] to-[#F0FBF6] p-5">{feature.visual}</div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const READS = [
  "The PLU list, prices and departments",
  "Daily, shift and monthly sales reports",
  "Individual transactions, for the sales history"
];
const NEVER = [
  "Change a price on the register",
  "Edit, void or refund a sale",
  "Touch card processing or the pumps"
];

export function ProductClient() {
  return (
    <PageFrame>
      <PageHero
        eyebrow="What it does"
        title={
          <>
            Every item. What you paid.{" "}
            <span className="bg-gradient-to-r from-[#1A63F4] to-[#00A87B] bg-clip-text text-transparent">
              What you make.
            </span>
          </>
        }
        lede="The register knows the shelf price. Your invoices know the cost. StoreDesk puts the two side by side for every item, so the margin on any of your few thousand products is one search away."
        actions={
          <>
            <Link href="/download" className={primaryButton}>
              Get StoreDesk <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/how-it-works" className={secondaryButton}>
              See how setup works
            </Link>
          </>
        }
        aside={<MarginChecker />}
      >
        <p className="mt-4 text-[14.5px] text-[var(--muted)]">
          Try it: pick an item, then drag the shelf price.
        </p>
      </PageHero>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHead
          eyebrow="In the box"
          title="Six jobs the back office does every week"
          lede="Each one runs on the PC in your back office. Pick one to see what it looks like."
        />
        <FeatureExplorer />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="overflow-hidden rounded-[32px] bg-[#17202A] text-white">
          <div className="grid gap-10 p-8 md:grid-cols-[1.3fr_1fr] md:p-12">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold">
                <WifiOff className="h-3.5 w-3.5" />
                When the line goes down
              </span>
              <h2 className="sd-h2 mt-5 !text-white">The register keeps trading, so StoreDesk does too</h2>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/75">
                The catalogue, prices and sales history live on your PC, not in somebody’s data
                centre. Staff who are signed in keep working with no internet for{" "}
                {PLANS.offlineSessionHours} hours — a full shift — because their sign-in is checked
                on your own machine.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-6 self-center md:grid-cols-1">
              <div>
                <dt className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-white/55">Works offline for</dt>
                <dd className="sd-num mt-1 text-[36px] font-semibold">{PLANS.offlineSessionHours} hrs</dd>
              </div>
              <div>
                <dt className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-white/55">Sales data in the cloud</dt>
                <dd className="mt-1 text-[36px] font-semibold">None</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHead
            eyebrow="Works with Verifone Commander"
            title="It reads from your register. It never writes to it."
            lede="The account StoreDesk connects with only needs permission to view. There is nothing it can break at the till."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border border-[#00A87B]/25 bg-white p-7">
              <p className="text-[14px] font-bold uppercase tracking-[0.1em] text-[#00875F]">StoreDesk reads</p>
              <ul className="mt-4 space-y-3">
                {READS.map((r) => (
                  <li key={r} className="flex gap-3 text-[16.5px]">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#00A87B]" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-white p-7">
              <p className="text-[14px] font-bold uppercase tracking-[0.1em] text-[#B42318]">StoreDesk never</p>
              <ul className="mt-4 space-y-3">
                {NEVER.map((r) => (
                  <li key={r} className="flex gap-3 text-[16.5px]">
                    <X className="mt-1 h-4 w-4 shrink-0 text-[#D92D20]" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
