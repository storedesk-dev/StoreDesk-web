"use client";

import { useMemo, useState } from "react";

/**
 * The sum StoreDesk does on every item, shelf price minus the cheapest cost of one, as something a
 * visitor can try. Every item, supplier and figure here is an example, and the panel says so.
 */

type Vendor = { name: string; caseCost: number; units: number };
type Item = { plu: string; name: string; shelf: number; vendors: Vendor[] };

const EXAMPLE_ITEMS: Item[] = [
  {
    plu: "000120",
    name: "Cola, 20 oz bottle",
    shelf: 2.49,
    vendors: [
      { name: "Wholesaler A", caseCost: 27.36, units: 24 },
      { name: "Distributor B", caseCost: 28.8, units: 24 },
      { name: "Cash and carry", caseCost: 15.48, units: 12 }
    ]
  },
  {
    plu: "000884",
    name: "Energy drink, 8.4 oz",
    shelf: 3.29,
    vendors: [
      { name: "Distributor B", caseCost: 45.12, units: 24 },
      { name: "Wholesaler A", caseCost: 46.8, units: 24 },
      { name: "Cash and carry", caseCost: 23.1, units: 12 }
    ]
  },
  {
    plu: "002250",
    name: "Tortilla chips, 9.25 oz",
    shelf: 5.79,
    vendors: [
      { name: "Distributor B", caseCost: 40.8, units: 12 },
      { name: "Wholesaler A", caseCost: 42.0, units: 12 }
    ]
  },
  {
    plu: "003051",
    name: "Ground coffee, 30.5 oz",
    shelf: 14.99,
    vendors: [
      { name: "Cash and carry", caseCost: 63.0, units: 6 },
      { name: "Wholesaler A", caseCost: 65.4, units: 6 }
    ]
  }
];

const money = (n: number) => `$${n.toFixed(2)}`;

function marginTone(pct: number) {
  if (pct < 20) return { text: "text-[var(--amber-ink)]", bar: "bg-[#F79009]", label: "Thin" };
  if (pct < 35) return { text: "text-[var(--blue-ink)]", bar: "bg-[var(--blue)]", label: "Fair" };
  return { text: "text-[var(--green-ink)]", bar: "bg-[var(--green)]", label: "Healthy" };
}

export function MarginChecker() {
  const [itemIndex, setItemIndex] = useState(0);
  const item = EXAMPLE_ITEMS[itemIndex];
  const [price, setPrice] = useState(item.shelf);

  const vendors = useMemo(
    () => item.vendors.map((v) => ({ ...v, unit: v.caseCost / v.units })).sort((a, b) => a.unit - b.unit),
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
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <p id="margin-items" className="text-[16px] font-bold">
          Pick an example item
        </p>
        <div role="group" aria-labelledby="margin-items" className="mt-3 grid gap-2 sm:grid-cols-2">
          {EXAMPLE_ITEMS.map((it, index) => {
            const active = index === itemIndex;
            return (
              <button
                key={it.plu}
                type="button"
                onClick={() => pick(index)}
                aria-pressed={active}
                className={`min-h-12 rounded-[var(--radius-sm)] border px-4 py-2.5 text-left transition-colors ${
                  active ? "border-[var(--blue)] bg-[var(--blue-tint)]" : "border-[var(--line-strong)] bg-white hover:border-[var(--blue)]"
                }`}
              >
                <span className="block text-[16px] font-semibold">{it.name}</span>
                <span className="sd-num block text-[14px] text-[var(--muted)]">PLU {it.plu}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-8 text-[16px] font-bold">What each supplier charges, cheapest first</p>
        <ul className="mt-3 divide-y divide-[var(--line)] rounded-[var(--radius-md)] border border-[var(--line)] bg-white">
          {vendors.map((v, i) => (
            <li key={`${item.plu}-${v.name}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[16px] font-semibold">
                  {v.name}
                  {i === 0 ? (
                    <span className="ml-2 rounded-full bg-[var(--green-tint)] px-2 py-0.5 text-[13px] font-bold text-[var(--green-ink)]">Cheapest</span>
                  ) : null}
                </p>
                <p className="sd-num text-[14px] text-[var(--muted)]">
                  {money(v.caseCost)} for {v.units}
                </p>
              </div>
              <p className="sd-num shrink-0 text-[17px] font-bold">
                {money(v.unit)}
                <span className="text-[14px] font-normal text-[var(--muted)]"> each</span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="sd-stage min-w-0 self-start rounded-[var(--radius-lg)] p-6">
        <div className="flex items-end justify-between gap-4">
          <label htmlFor="shelf-price" className="text-[15px] text-[var(--stage-muted)]">
            Shelf price
            <span className="sd-num mt-1 block text-[32px] font-extrabold text-white">{money(price)}</span>
          </label>
          <div className="text-right">
            <p className="text-[15px] text-[var(--stage-muted)]">Margin</p>
            <p className="sd-num mt-1 text-[32px] font-extrabold text-white">{pct.toFixed(1)}%</p>
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
          className="mt-5 h-11 w-full accent-[#3fd1a2]"
        />
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div
            className={`h-full rounded-full transition-[width] duration-200 ${tone.bar}`}
            style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
          />
        </div>
        <p className="mt-4 text-[16px] text-[var(--stage-muted)]">
          <span className="sd-num font-bold text-white">{money(profit)}</span> on each one sold. {tone.label}.
        </p>
        {changed ? (
          <button
            type="button"
            onClick={() => setPrice(item.shelf)}
            className="mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-white/25 px-4 text-[15px] font-semibold text-white hover:border-white"
          >
            Back to the register price, {money(item.shelf)}
          </button>
        ) : (
          <p className="mt-4 text-[15px] text-[var(--stage-muted)]">This is the register price. Drag to try another.</p>
        )}
        <p className="mt-6 border-t border-white/10 pt-4 text-[14px] text-[var(--stage-muted)]">
          Example items and suppliers. In StoreDesk these come from your register and your invoices.
        </p>
      </div>
    </div>
  );
}
