"use client";

import { useState } from "react";
import { PLANS } from "@/lib/site";

/**
 * "What happens when the line drops", as a switch. Each row matches what the product does: the
 * store side runs on the store network; the phones away from the store, the Google Sheet and the
 * account need the internet.
 */

type Row = { name: string; where: "store" | "outside"; online: string; offline: string; offlineState: "up" | "limited" | "down" };

const ROWS: Row[] = [
  { name: "Register and store PC", where: "store", online: "Prices and sales over the store network", offline: "Carry on. They never used the internet", offlineState: "up" },
  { name: "StoreDesk Desktop", where: "store", online: "Price book, costs, reports, sales tax", offline: "Works as normal. It runs on the same PC", offlineState: "up" },
  {
    name: "Staff sign-in",
    where: "store",
    online: "Signs in and stays signed in for a shift",
    // Passwords are checked by StoreDesk Service on the store PC, so signing in fresh works with the
    // line down, not just staying signed in.
    offline: `Still works. Passwords are checked on the store PC, and a session lasts ${PLANS.offlineSessionHours} hours`,
    offlineState: "up"
  },
  {
    name: "StoreDesk Mobile",
    where: "outside",
    online: "Prices and takings from anywhere",
    // Local network access is off by default, so the honest default answer is "paused".
    offline: "Back when the line is, unless an admin turned on local network access",
    offlineState: "down"
  },
  { name: "Google Sheet", where: "outside", online: "Daily sales written on schedule", offline: "Writes the days it missed once the line is back", offlineState: "down" },
  { name: "Your StoreDesk account", where: "outside", online: "Licence and connected PCs", offline: "Not needed to keep trading", offlineState: "limited" }
];

const STATE = {
  up: { dot: "bg-[var(--green)]", label: "Working", text: "text-[var(--green-ink)]" },
  limited: { dot: "bg-[#F79009]", label: "Holding", text: "text-[var(--amber-ink)]" },
  down: { dot: "bg-[#98A2B3]", label: "Paused", text: "text-[var(--muted)]" }
} as const;

export function OutageSimulator() {
  const [offline, setOffline] = useState(false);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white p-5 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[18px] font-bold">
          Internet at the store:{" "}
          <span className={offline ? "text-[var(--red-ink)]" : "text-[var(--green-ink)]"}>{offline ? "down" : "connected"}</span>
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={offline}
          onClick={() => setOffline((v) => !v)}
          className={`inline-flex min-h-12 items-center gap-3 rounded-full border px-2 pr-5 text-[16px] font-bold transition-colors ${
            offline ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--line-strong)] bg-[var(--wash)] text-[var(--ink)]"
          }`}
        >
          <span className={`relative h-7 w-12 rounded-full ${offline ? "bg-white/25" : "bg-[var(--line-strong)]"}`} aria-hidden>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ${offline ? "left-6" : "left-1"}`} />
          </span>
          Internet line down
        </button>
      </div>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {(["store", "outside"] as const).map((group) => (
          <div key={group}>
            <h3 className="text-[17px] font-extrabold">{group === "store" ? "Inside the store" : "Needs the internet"}</h3>
            <ul className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {ROWS.filter((row) => row.where === group).map((row) => {
                const state = STATE[offline ? row.offlineState : "up"];
                return (
                  <li key={row.name} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[17px] font-bold">{row.name}</p>
                      <span className={`inline-flex items-center gap-1.5 text-[15px] font-bold ${state.text}`}>
                        <span className={`h-2.5 w-2.5 rounded-full ${state.dot}`} aria-hidden />
                        {state.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[16px] text-[var(--muted)]">{offline ? row.offline : row.online}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
