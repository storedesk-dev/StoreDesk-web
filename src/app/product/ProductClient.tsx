"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  FileCode2,
  Fuel,
  Percent,
  RefreshCw,
  Search,
  BookOpen,
  Check,
  FileSpreadsheet,
  Monitor,
  Receipt,
  ScanLine,
  Server,
  Smartphone,
  Tags,
  Ticket,
  WifiOff,
  X
} from "lucide-react";
import { PageFrame, PageHero, primaryButton, secondaryButton } from "@/components/PageHero";
import { LaptopFrame, PhoneFrame } from "@/components/DeviceFrame";
import { DOCS, PLANS } from "@/lib/site";
import { FAQ } from "@/lib/faq";

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
  return { text: "text-[#006B4B]", bar: "bg-[#00A87B]", label: "Healthy" };
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
                      <span className="ml-2 rounded-full bg-[#00A87B]/12 px-2 py-0.5 text-[11px] font-semibold text-[#006B4B]">
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
          aria-valuetext={`${money(price)}, margin ${pct.toFixed(1)} percent`}
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
  /** A label short enough for the two-column picker on a phone. */
  short: string;
  body: string;
  detail: string;
  where: Array<"Desktop" | "Phone">;
  visual: ReactNode;
};

/** A table inside a device frame: a header row, then rows, at a size that reads at panel scale. */
function SheetRows({ head, widths, rows }: { head: string[]; widths: string; rows: string[][] }) {
  return (
    <div className="text-[11.5px]">
      <div className={`grid ${widths} gap-2 bg-[#F9FAFB] px-3 py-1.5 font-semibold text-[var(--muted)]`}>
        {head.map((cell) => (
          <span key={cell} className={cell === head[head.length - 1] ? "text-right" : ""}>
            {cell}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row[0] + row[1]} className={`grid ${widths} gap-2 border-t border-[var(--border)] px-3 py-1.5`}>
          {row.map((cell, i) => (
            <span
              key={i}
              className={`truncate ${i === 0 || i >= 2 ? "sd-num" : ""} ${i === row.length - 1 ? "text-right font-semibold" : ""}`}
            >
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

const WEEK = [62, 71, 58, 80, 94, 100, 77];

const FEATURES: Feature[] = [
  {
    key: "price-book",
    short: "Price book",
    icon: <BookOpen className="h-5 w-5" />,
    title: "Price book",
    body: "Every PLU on your register in one searchable list, searched by barcode, name or department.",
    detail:
      "StoreDesk pulls the full PLU list from the Commander and only rewrites the items that changed, so refreshing a ten-thousand-item catalogue is quick and quiet.",
    where: ["Desktop", "Phone"],
    visual: (
      <LaptopFrame chrome="StoreDesk — Price Book">
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[#F9FAFB] px-3 py-2">
          <Search className="h-3.5 w-3.5 text-[#667085]" aria-hidden />
          <span className="text-[11.5px] text-[#667085]">Search 9,412 items</span>
        </div>
        <SheetRows
          head={["PLU", "Item", "Price"]}
          widths="grid-cols-[64px_1fr_58px]"
          rows={[
            ["000120", "Cola, 20 oz bottle", "$2.49"],
            ["000884", "Energy drink, 8.4 oz", "$3.29"],
            ["002250", "Tortilla chips, 9.25 oz", "$5.79"],
            ["003051", "Ground coffee, 30.5 oz", "$12.99"]
          ]}
        />
      </LaptopFrame>
    )
  },
  {
    key: "vendor-costs",
    short: "Supplier costs",
    icon: <Tags className="h-5 w-5" />,
    title: "Supplier costs side by side",
    body: "What each supplier charges for the same item, cheapest first, with the margin worked out.",
    detail:
      "Enter costs by the case or the pack; StoreDesk turns them into a price per unit, so a 24-pack from one supplier and a 12-pack from another compare fairly.",
    where: ["Desktop", "Phone"],
    visual: (
      <LaptopFrame chrome="StoreDesk — Cost Analysis">
        <div className="border-b border-[var(--border)] px-3 py-2">
          <p className="text-[12.5px] font-semibold">Cola, 20 oz bottle</p>
          <p className="sd-num text-[11px] text-[var(--muted)]">Shelf $2.49 · PLU 000120</p>
        </div>
        <div className="space-y-2.5 p-3">
          {[
            ["Peach State Wholesale", "$27.36 / 24", "$1.14", 88, true],
            ["Hwy 41 Distributing", "$28.80 / 24", "$1.20", 93, false],
            ["Cash & carry", "$15.48 / 12", "$1.29", 100, false]
          ].map(([name, pack, unit, width, best]) => (
            <div key={name as string}>
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="flex items-center gap-1.5">
                  {name}
                  {best ? (
                    <span className="rounded-full bg-[#00A87B]/12 px-1.5 py-0.5 text-[10px] font-bold text-[#006B4B]">Best</span>
                  ) : null}
                </span>
                <span className="sd-num text-[var(--muted)]">{pack as string}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-[#F2F4F7]">
                  <div
                    className={`h-full rounded-full ${best ? "bg-[#00A87B]" : "bg-[#C8CFDA]"}`}
                    style={{ width: `${width as number}%` }}
                  />
                </div>
                <span className="sd-num w-12 text-right text-[12px] font-semibold">{unit as string}</span>
              </div>
            </div>
          ))}
        </div>
      </LaptopFrame>
    )
  },
  {
    key: "scan",
    short: "Scanning",
    icon: <ScanLine className="h-5 w-5" />,
    title: "Scan on the floor",
    body: "Point your phone at a shelf tag and see the price, what you paid and the margin.",
    detail:
      "Leading zeros and UPC/EAN variants are normalised before the lookup, so a code scanned off a shelf matches the same item as one typed at the desk.",
    where: ["Phone"],
    visual: (
      <PhoneFrame>
        {/* The viewfinder, then the result the scan produced. */}
        <div className="relative h-28 bg-[#0B1220]">
          <div className="absolute inset-4 rounded-lg border-2 border-white/25" />
          <div className="absolute inset-x-8 top-1/2 h-px bg-[#28C88B] shadow-[0_0_10px_#28C88B]" />
          <div className="absolute inset-x-10 top-[46%] flex h-6 items-end justify-between">
            {[7, 3, 9, 4, 8, 3, 6, 9, 4, 7, 3, 8].map((w, i) => (
              <span key={i} className="h-full bg-white/80" style={{ width: `${w}px` }} />
            ))}
          </div>
        </div>
        <div className="px-3.5 pb-4 pt-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#006B4B]">
            <Check className="h-3 w-3" aria-hidden />
            Scanned
          </p>
          <p className="mt-1 text-[14px] font-bold leading-snug">Cola, 20 oz bottle</p>
          <p className="sd-num text-[10.5px] text-[var(--muted)]">0 49000 00012 0</p>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
            {[
              ["Price", "$2.49", "text-[#17202A]"],
              ["Cost", "$1.14", "text-[#17202A]"],
              ["Margin", "54%", "text-[#006B4B]"]
            ].map(([k, v, tone]) => (
              <div key={k} className="rounded-lg bg-[#F5F8FF] py-1.5">
                <p className="text-[9.5px] text-[var(--muted)]">{k}</p>
                <p className={`sd-num text-[13px] font-bold ${tone}`}>{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-2.5 rounded-lg bg-[#00A87B]/10 px-2 py-1.5 text-[10.5px] text-[#006B4B]">
            Cheapest: Peach State Wholesale, $1.14 each
          </p>
        </div>
      </PhoneFrame>
    )
  },
  {
    key: "fuel",
    short: "Fuel",
    icon: <Fuel className="h-5 w-5" />,
    title: "Fuel Center",
    body: "Every grade, the price on each pump, and what the tanks are doing, without another printout.",
    detail:
      "Fuel comes across with the rest of the register's day, so the inside and outside halves of a shift sit in one place instead of a spreadsheet and a receipt.",
    where: ["Desktop", "Phone"],
    visual: (
      <LaptopFrame chrome="StoreDesk — Fuel Center">
        <SheetRows
          head={["Grade", "Price", "Volume", "Sales"]}
          widths="grid-cols-[72px_58px_64px_1fr]"
          rows={[
            ["Regular", "$2.899", "1,842 gal", "$5,340"],
            ["Plus", "$3.199", "312 gal", "$998"],
            ["Premium", "$3.499", "186 gal", "$651"],
            ["Diesel", "$3.049", "624 gal", "$1,903"]
          ]}
        />
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[#F9FAFB] px-3 py-2 text-[11.5px]">
          <span className="text-[var(--muted)]">Fuel today</span>
          <span className="sd-num font-bold">$8,892</span>
        </div>
      </LaptopFrame>
    )
  },
  {
    key: "deals",
    short: "Deals",
    icon: <Percent className="h-5 w-5" />,
    title: "Deals and price groups",
    body: "The multi-buys running on your register, and what each one is making.",
    detail:
      "Read from the register, with the margin on each. Deals are still changed on the register: StoreDesk does not send them yet. Price groups let you change a set of items together in the price book.",
    where: ["Desktop", "Phone"],
    visual: (
      <LaptopFrame chrome="StoreDesk — Deals">
        <SheetRows
          head={["Deal", "Items", "Price", "Margin"]}
          widths="grid-cols-[1fr_40px_52px_50px]"
          rows={[
            ["2 for $4.00 · 20 oz bottles", "14", "$4.00", "42%"],
            ["3 for $5.00 · candy bars", "22", "$5.00", "38%"],
            ["2 for $6.00 · energy 8.4 oz", "9", "$6.00", "31%"]
          ]}
        />
        <div className="border-t border-[var(--border)] bg-[#F5F8FF] px-3 py-2 text-[11.5px] text-[#1A63F4]">
          Price group &ldquo;20 oz bottles&rdquo; — 14 items updated together
        </div>
      </LaptopFrame>
    )
  },
  {
    key: "sales",
    short: "Sales",
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Sales from the register",
    body: "Daily, shift and monthly totals read straight from the Commander. Nothing to rekey.",
    detail:
      "Department splits, fuel, lottery, card and cash come across as the register recorded them, alongside the individual transactions.",
    where: ["Desktop", "Phone"],
    visual: (
      <LaptopFrame chrome="StoreDesk — Dashboard">
        <div className="p-3">
          <div className="flex items-end gap-2" style={{ height: "88px" }}>
            {WEEK.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-t-md bg-gradient-to-t from-[#1A63F4] to-[#28C88B]" style={{ height: `${h}%` }} />
                <span className="text-[10px] text-[var(--muted)]">{"MTWTFSS"[i]}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-2.5 text-center">
            {[
              ["Inside", "$3,412"],
              ["Fuel", "$6,980"],
              ["Total", "$10,392"]
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] text-[var(--muted)]">{k}</p>
                <p className="sd-num text-[12.5px] font-bold">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </LaptopFrame>
    )
  },
  {
    key: "st3",
    short: "Sales tax",
    icon: <Receipt className="h-5 w-5" />,
    title: "Georgia ST-3 sales tax",
    body: "Your monthly return worked out on screen, then written as a file you upload to the Georgia Tax Center.",
    detail:
      "Taxable and exempt sales, jurisdiction distributions and vendor's compensation are worked out from register data you already have. You review every line before anything leaves the PC, and StoreDesk never files on your behalf. Georgia is the only state supported today.",
    where: ["Desktop"],
    visual: (
      <div className="space-y-2.5">
        <LaptopFrame chrome="StoreDesk — Sales Tax · August">
          <SheetRows
            head={["Line", "Description", "Amount"]}
            widths="grid-cols-[34px_1fr_72px]"
            rows={[
              ["1", "Gross sales", "$84,210"],
              ["2", "Exempt sales", "$21,905"],
              ["3", "Taxable sales", "$62,305"],
              ["15", "Vendor's compensation", "-$92.14"]
            ]}
          />
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[#F5F8FF] px-3 py-2">
            <span className="text-[11.5px] font-semibold text-[#1A63F4]">Amount due</span>
            <span className="sd-num text-[13px] font-bold text-[#1A63F4]">$4,269.21</span>
          </div>
        </LaptopFrame>
        {/* What you do with it: one file, uploaded by you, to the only portal supported today. */}
        <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-white p-3">
          <span className="flex h-9 shrink-0 items-center rounded-lg bg-[#17202A] px-2 text-[11px] font-bold text-white">GTC</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11.5px] font-semibold leading-tight">Georgia Tax Center</span>
            <span className="block text-[10.5px] leading-tight text-[var(--muted)]">You upload it yourself</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-[#98A2B3]" aria-hidden />
          <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-[#1A63F4]/40 bg-[#F5F8FF] px-2.5 py-2">
            <FileCode2 className="h-4 w-4 text-[#1A63F4]" aria-hidden />
            <span className="sd-num text-[10.5px] font-semibold text-[#1A63F4]">ST-3.xml</span>
          </span>
        </div>
      </div>
    )
  },
  {
    key: "sheets",
    short: "Google Sheet",
    icon: <FileSpreadsheet className="h-5 w-5" />,
    title: "Your own Google Sheet",
    body: "Daily sales written into a spreadsheet you own, on a schedule or when you ask.",
    detail:
      "Map the columns once. If your accountant already has a sheet they like, StoreDesk writes into that one instead of making you adopt a new format, and after an outage it writes the days it missed.",
    where: ["Desktop"],
    visual: (
      <div className="space-y-2.5">
        <LaptopFrame chrome="Google Sheets — Daily sales">
          <SheetRows
            head={["Date", "Inside", "Fuel", "Total"]}
            widths="grid-cols-[62px_1fr_1fr_1fr]"
            rows={[
              ["09/08", "$3,412", "$6,980", "$10,392"],
              ["09/09", "$3,105", "$7,214", "$10,319"],
              ["09/10", "$3,688", "$6,402", "$10,090"]
            ]}
          />
        </LaptopFrame>
        <p className="flex items-center justify-center gap-2 text-[12px] text-[#006B4B]">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Synced this morning, to a sheet in your own Google account
        </p>
      </div>
    )
  }
];

/**
 * The screens, one at a time.
 *
 * A real ARIA tab set: one tab stop, arrow keys and Home/End move between tabs, and each tab names
 * the panel it controls. Before, every tab was its own stop and the arrow keys did nothing.
 */
function FeatureExplorer() {
  const [active, setActive] = useState(FEATURES[0].key);
  const reduceMotion = useReducedMotion();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const feature = FEATURES.find((f) => f.key === active) ?? FEATURES[0];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = FEATURES.findIndex((f) => f.key === active);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % FEATURES.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + FEATURES.length) % FEATURES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = FEATURES.length - 1;
    if (next < 0) return;
    event.preventDefault();
    setActive(FEATURES[next].key);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="mt-10 grid gap-5 lg:grid-cols-[320px_1fr]">
      {/*
        Two columns of short labels fit on any phone at once, and the full titles come back in the
        single column the desktop has room for.
      */}
      <div
        role="tablist"
        aria-label="Screens"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1"
      >
        {FEATURES.map((f, i) => {
          const on = f.key === active;
          return (
            <button
              key={f.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`feature-tab-${f.key}`}
              role="tab"
              type="button"
              aria-selected={on}
              aria-controls="feature-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(f.key)}
              className={`relative isolate flex min-h-11 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition-colors lg:gap-3 lg:px-4 lg:py-3 ${
                on ? "text-white" : "bg-white/70 text-[#17202A] hover:bg-white"
              }`}
            >
              {on ? (
                <motion.span
                  layoutId="feature-chip"
                  className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-[#1A63F4] to-[#00875F] shadow-[0_10px_24px_-10px_rgba(26,99,244,0.6)]"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
                />
              ) : null}
              <span className={`relative shrink-0 ${on ? "text-white" : "text-[#1A63F4]"}`}>{f.icon}</span>
              <span className="relative text-[14px] font-semibold leading-tight lg:hidden">{f.short}</span>
              <span className="relative hidden text-[15.5px] font-semibold lg:inline">{f.title}</span>
            </button>
          );
        })}
      </div>

      <div
        id="feature-panel"
        role="tabpanel"
        aria-labelledby={`feature-tab-${feature.key}`}
        tabIndex={0}
        className="min-w-0 rounded-[28px] border border-[var(--border)] bg-white p-5 sm:p-6 md:p-8"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={feature.key}
            initial={{ y: reduceMotion ? 0 : 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduceMotion ? 0 : -6, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
            className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-center"
          >
            <div className="min-w-0">
              <h3 className="text-[24px] font-bold tracking-tight">{feature.title}</h3>
              <p className="mt-3 text-[17px] leading-relaxed text-[#17202A]">{feature.body}</p>
              <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--muted)]">{feature.detail}</p>
              <ul className="mt-5 flex flex-wrap gap-2" aria-label="Where it is">
                {feature.where.map((w) => (
                  <li
                    key={w}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[#F5F8FF] px-3 py-1 text-[13px] font-semibold text-[#17202A]"
                  >
                    {w === "Desktop" ? <Monitor className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                    {w === "Desktop" ? "StoreDesk Desktop" : "StoreDesk Mobile"}
                  </li>
                ))}
              </ul>
            </div>
            {/* An illustration with example data, so it is hidden from screen readers. */}
            <div className="min-w-0 rounded-2xl bg-gradient-to-br from-[#F5F8FF] to-[#F0FBF6] p-4 sm:p-5" aria-hidden="true">
              {feature.visual}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The four products.
 *
 * Every line here is checked against the app it describes (store-desk-electron, store-desk-mobile,
 * store-desk-server, store-desk-lottery) and the user guide. "What's coming" lists only work that is
 * actually planned, and says plainly what is not done yet.
 * ---------------------------------------------------------------------------------------------- */

type Product = {
  id: string;
  name: string;
  icon: ReactNode;
  line: string;
  who: string;
  jobs: string[];
  connects: string[];
  needs: string[];
  coming: string[];
  more?: { href: string; label: string; external?: boolean };
};

const PRODUCTS: Product[] = [
  {
    id: "desktop",
    name: "StoreDesk Desktop",
    icon: <Monitor className="h-6 w-6" />,
    line: "The back office, on the Windows PC in your store.",
    who: "The owner and managers. Each person sees only the screens their role allows.",
    jobs: [
      "Dashboard: today's sales and transactions at a glance.",
      "Price book: every PLU from the register. Search, edit an item, add a new one, change a group of items together.",
      "Supplier costs: what each supplier charges per unit, cheapest first, with the margin.",
      "Register changes: send an item change to the register. StoreDesk checks the item first and reads it back.",
      "Sales: daily, shift and monthly reports from the register, single transactions, and each item's sales history.",
      "Fuel Center: grades, pump prices and what each grade sold.",
      "Deals: the multi-buys running on your register.",
      "Sales tax: the Georgia ST-3 worked out, as a file you upload yourself.",
      "Google Sheet: daily sales written to a sheet you own.",
      "Users and roles: staff accounts, and which screens each role opens.",
      "Lottery: the days StoreDesk Lottery sent, when the store runs it."
    ],
    connects: [
      "Talks to StoreDesk Service on the same PC.",
      "Needs no internet to run the store."
    ],
    needs: ["Windows 10 or later.", "Installed with StoreDesk Service, in one installer.", "One licence per store."],
    coming: [
      "Sending deal and fuel price changes to the register. Change them on the register for now.",
      "Supplier invoices by EDI, so costs arrive without typing. Planned."
    ],
    more: { href: DOCS.desktop, label: "Desktop guide", external: true }
  },
  {
    id: "mobile",
    name: "StoreDesk Mobile",
    icon: <Smartphone className="h-6 w-6" />,
    line: "StoreDesk on an Android phone, on the floor or away from the store.",
    who: "Staff on the shop floor, and the owner away from the store.",
    jobs: [
      "Scan a barcode: shelf price, what you paid, margin and the cheapest supplier.",
      "Search the price book and open any item.",
      "Today's sales and analytics from the register.",
      "Transactions, line by line, with tax and payment.",
      "Fuel prices, deals, reports and the sales tax figures.",
      "Save an item change and send it, if your role allows."
    ],
    connects: [
      "Reaches StoreDesk Service on the store PC through a secure tunnel.",
      "On the store Wi-Fi it can connect directly, once an admin turns on local network access.",
      "Each person signs in with their own StoreDesk account."
    ],
    needs: ["Android 5.0 or later, from Google Play.", "The internet, when away from the store.", "iPhone: not released yet."],
    coming: ["An iPhone app. Being prepared, no date yet."],
    more: { href: DOCS.mobile, label: "Mobile guide", external: true }
  },
  {
    id: "service",
    name: "StoreDesk Service",
    icon: <Server className="h-6 w-6" />,
    line: "The background program on the store PC. It holds your data and talks to the register.",
    who: "Nobody uses it directly. You install it once, and StoreDesk Desktop shows that it is running.",
    jobs: [
      "Keeps the price book, costs and sales history in one database on the store PC.",
      "Reads the Verifone Commander over the store network: PLUs, reports and transactions.",
      "Sends an item change to the register only when a person sends it.",
      "Checks sign-ins on the PC, so staff can sign in with the internet down.",
      "Serves StoreDesk Desktop, StoreDesk Mobile, and the days StoreDesk Lottery sends.",
      "Writes the daily Google Sheet, and catches up on days it missed.",
      "Starts by itself after a restart, and keeps the PC from sleeping.",
      "Backs up its database on the PC before each update."
    ],
    connects: [
      "Your store data never leaves this PC.",
      "Your StoreDesk account holds only the store, its licence, its PC and its people."
    ],
    needs: [
      "A Windows 10 or later PC in the back office, left on.",
      "That PC must reach the Verifone Commander on the store network.",
      "A setup key, emailed when your store is set up.",
      "One licence per store, covering one store PC."
    ],
    coming: ["Sending deals and fuel prices, once tested on a real register."],
    more: { href: DOCS.service, label: "Service guide", external: true }
  },
  {
    id: "lottery",
    name: "StoreDesk Lottery",
    icon: <Ticket className="h-6 w-6" />,
    line: "The instant-ticket rack and the shift close, on the lottery counter PC.",
    who: "Clerks close the shift. Owners and managers check reports, correct days and set up the rack.",
    jobs: [
      "Rack: every box, what is in it, and how far through each pack is.",
      "Receive packs by scanning each one into stock.",
      "Put a pack out in a box, from stock or straight off the truck.",
      "Packs by state: in stock, on the rack, held, sold out, taken off, returned, settled.",
      "Close a shift by scanning the ticket showing in each box.",
      "Correct a closed day. Each correction is a new version with a reason.",
      "Settle the packs that are due, in one click.",
      "Shift report with Print, a daily report, and what to order.",
      "Set up the rack to match your counter.",
      "People and roles: the same sign-in as StoreDesk.",
      "A demo store with sample data, to try it first."
    ],
    connects: [
      "Runs on its own, with its own installer and database.",
      "With StoreDesk, each closed day's lottery cash goes to StoreDesk Service. Packs and games stay on the lottery PC."
    ],
    needs: [
      "A Windows PC at the lottery counter: the store PC or another.",
      "A barcode scanner.",
      "Georgia Lottery instant tickets.",
      "A StoreDesk sign-in for each person."
    ],
    coming: ["Shift reports by email. Coming soon."],
    more: { href: "/product/lottery", label: "All about StoreDesk Lottery" }
  }
];

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">{title}</h4>
      <ul className="mt-2 space-y-1.5 text-[15.5px] leading-relaxed text-[#17202A]">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#1A63F4]" aria-hidden />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProductSection({ product, tinted }: { product: Product; tinted: boolean }) {
  const moreClass =
    "mt-6 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-[#1A63F4] hover:underline";
  return (
    <section
      id={product.id}
      aria-labelledby={`${product.id}-heading`}
      className={`border-t border-[var(--border)] ${tinted ? "bg-white/60" : ""}`}
    >
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1A63F4] to-[#00875F] text-white">
            {product.icon}
          </span>
          <div className="min-w-0">
            <h2 id={`${product.id}-heading`} className="sd-h2">
              {product.name}
            </h2>
            <p className="sd-lede mt-2">{product.line}</p>
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div className="min-w-0 rounded-3xl border border-[var(--border)] bg-white p-6 md:p-7">
            <h3 className="text-[19px] font-bold tracking-tight">What it does</h3>
            <ul className="mt-4 space-y-2.5">
              {product.jobs.map((job) => (
                <li key={job} className="flex gap-3 text-[16px] leading-relaxed">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-[#00875F]" />
                  <span className="min-w-0">{job}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 space-y-6 rounded-3xl border border-[var(--border)] bg-white p-6 md:p-7">
            <h3 className="sr-only">Details</h3>
            <DetailList title="Who uses it" items={[product.who]} />
            <DetailList title="How it connects" items={product.connects} />
            <DetailList title="What you need" items={product.needs} />
            <DetailList title="What's coming" items={product.coming} />
          </div>
        </div>

        {product.more ? (
          product.more.external ? (
            <a href={product.more.href} className={moreClass}>
              {product.more.label}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          ) : (
            <Link href={product.more.href} className={moreClass}>
              {product.more.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )
        ) : null}
      </div>
    </section>
  );
}

/** In-page navigation: one link per section, wrapping onto a second line on a phone. */
const ON_THIS_PAGE = [
  { href: "#desktop", label: "Desktop" },
  { href: "#mobile", label: "Mobile" },
  { href: "#service", label: "Service" },
  { href: "#lottery", label: "Lottery" },
  { href: "#screens", label: "Screens" },
  { href: "#register", label: "Your register" },
  { href: "#questions", label: "Questions" }
];

const READS = [
  "The PLU list, prices and departments",
  "Daily, shift and monthly sales reports",
  "Individual transactions, for the sales history",
  "Deals and fuel prices"
];
/** A person starts each send (Register Changes, or Save and send on the phone). */
const ON_REQUEST = [
  "An item change you saved: price, details or a new item",
  "Checked first, only the changed fields sent, then read back"
];
/** True whatever the settings say — StoreDesk has no route to any of these. */
const NEVER = [
  "Edit, void or refund a sale",
  "Touch card processing or the pumps",
  "Send anything on its own, without a person"
];

export function ProductClient() {
  return (
    <PageFrame>
      <PageHero
        eyebrow="Product"
        title={
          <>
            Every item. What you paid.{" "}
            <span className="bg-gradient-to-r from-[#1A63F4] to-[#00875F] bg-clip-text text-transparent">
              What you make.
            </span>
          </>
        }
        lede="StoreDesk Desktop, Mobile and Service run the back office. StoreDesk Lottery runs the ticket rack. Your store data stays on the store PC."
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
        <p className="mt-4 text-[14.5px] text-[var(--muted)]">Try it: pick an item, then drag the shelf price.</p>
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

      {PRODUCTS.map((product, i) => (
        <ProductSection key={product.id} product={product} tinted={i % 2 === 1} />
      ))}

      <section id="screens" aria-labelledby="screens-heading" className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="sd-eyebrow">Desktop and Mobile</p>
            <h2 id="screens-heading" className="sd-h2 mt-3">
              {`${FEATURES.length} jobs, screen by screen`}
            </h2>
            <p className="sd-lede mt-4">Pick one to see it. The figures are examples.</p>
          </div>
          <FeatureExplorer />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20" aria-labelledby="offline-heading">
        <div className="overflow-hidden rounded-[32px] bg-[#17202A] text-white">
          <div className="grid gap-10 p-6 sm:p-8 md:grid-cols-[1.3fr_1fr] md:p-12">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold">
                <WifiOff className="h-3.5 w-3.5" />
                When the line goes down
              </span>
              <h2 id="offline-heading" className="sd-h2 mt-5 !text-white">
                The register keeps trading, so StoreDesk does too
              </h2>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/80">
                The register and the store PC talk over your own store network. A dead internet line changes
                nothing about the price book, the reports or the sales tax. Signing in is checked on that PC
                too.
              </p>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-white/80">
                After a restart, StoreDesk Service starts itself and catches up: the register sync, the phone
                tunnel and the daily export.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-6 self-center md:grid-cols-1">
              <div>
                <dt className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-white/70">Sales data in the cloud</dt>
                <dd className="mt-1 text-[32px] font-semibold sm:text-[36px]">None</dd>
              </div>
              <div>
                <dt className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-white/70">Needs the internet to run the store</dt>
                <dd className="mt-1 text-[32px] font-semibold sm:text-[36px]">Never</dd>
              </div>
              <div>
                <dt className="text-[12.5px] font-semibold uppercase tracking-[0.1em] text-white/70">A signed-in shift, offline</dt>
                <dd className="sd-num mt-1 text-[32px] font-semibold sm:text-[36px]">{PLANS.offlineSessionHours} hrs</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section id="register" aria-labelledby="register-heading" className="border-t border-[var(--border)] bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="sd-eyebrow">Works with Verifone Commander</p>
            <h2 id="register-heading" className="sd-h2 mt-3">
              It reads your register. It writes only when you say so.
            </h2>
            <p className="sd-lede mt-4">
              Sending to the register is off until you turn it on for a role, and every send is started and
              confirmed by a person. Deals and fuel prices are still changed on the register.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <div className="rounded-3xl border border-[#00A87B]/25 bg-white p-6 md:p-7">
              <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-[#006B4B]">StoreDesk reads</h3>
              <ul className="mt-4 space-y-3">
                {READS.map((r) => (
                  <li key={r} className="flex gap-3 text-[16.5px]">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#00875F]" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-[#B54708]/25 bg-white p-6 md:p-7">
              <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-[#B54708]">Only when you send it</h3>
              <ul className="mt-4 space-y-3">
                {ON_REQUEST.map((r) => (
                  <li key={r} className="flex gap-3 text-[16.5px]">
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[#B54708]" />
                    {r}
                  </li>
                ))}
              </ul>
              <a
                href={DOCS.topic("page.registerChanges")}
                className="mt-4 inline-flex min-h-11 items-center text-[14.5px] font-semibold text-[#1A63F4] hover:underline"
              >
                How sending to the register works
              </a>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-white p-6 md:p-7">
              <h3 className="text-[14px] font-bold uppercase tracking-[0.1em] text-[#B42318]">StoreDesk never</h3>
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

      <section id="questions" aria-labelledby="questions-heading" className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="sd-eyebrow">Questions</p>
            <h2 id="questions-heading" className="sd-h2 mt-3">
              What stores ask before they start
            </h2>
            <p className="sd-lede mt-4">Short answers, each linking to the longer one.</p>
          </div>
          <dl className="mt-10 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {FAQ.map((entry) => (
              <div key={entry.question} className="py-6">
                <dt className="text-[18.5px] font-bold tracking-tight">{entry.question}</dt>
                <dd className="mt-2.5 text-[16.5px] leading-relaxed text-[var(--muted)]">
                  {entry.answer}
                  {entry.href ? (
                    <>
                      {" "}
                      <a
                        href={entry.href}
                        className="whitespace-nowrap font-semibold text-[#1A63F4] hover:underline"
                      >
                        More on this<span className="sr-only">: {entry.question}</span>
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </PageFrame>
  );
}
