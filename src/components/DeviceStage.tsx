"use client";

import Image from "next/image";
import { motion } from "framer-motion";

/** Desktop chrome mock — Price Book vibe */
export function LaptopMock() {
  return (
    <motion.div
      className="relative w-full max-w-[560px]"
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Lid / screen shell */}
      <div className="rounded-t-2xl border border-slate-300 bg-gradient-to-b from-slate-200 to-slate-300 p-2.5 shadow-2xl shadow-blue-500/15">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-[var(--border)] bg-slate-50 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
            <div className="ml-2 flex h-6 flex-1 items-center rounded-md bg-white px-2.5 text-[10px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
              StoreDesk · Price Book Dashboard
            </div>
          </div>

          <div className="grid min-h-[220px] grid-cols-[88px_1fr] bg-[var(--surface)]">
            <aside className="flex flex-col gap-1 bg-gradient-to-b from-[#0E43D8] to-[#1A63F4] p-2.5">
              <Image
                src="/brand/logo-mark.jpg"
                alt=""
                width={36}
                height={36}
                className="mb-2 h-9 w-9 rounded-lg object-cover ring-1 ring-white/30"
              />
              {[
                { l: "Price Book", on: true },
                { l: "Cost Analysis", on: false },
                { l: "Reports", on: false },
                { l: "Invoices", on: false },
                { l: "Mobile Access", on: false }
              ].map((item) => (
                <div
                  key={item.l}
                  className={`rounded-md px-2 py-1.5 text-[9px] font-semibold ${
                    item.on ? "bg-white/20 text-white" : "text-white/75"
                  }`}
                >
                  {item.l}
                </div>
              ))}
            </aside>

            <div className="flex flex-col gap-2.5 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold text-[var(--foreground)]">Price Book & Costs</div>
                  <div className="text-[9px] text-[var(--muted)]">Live Register · Wholesale Vendor Costs</div>
                </div>
                <div className="rounded-md bg-[var(--sd-blue)] px-2.5 py-1 text-[9px] font-bold text-white">Refresh</div>
              </div>

              <div className="flex gap-1.5">
                <div className="h-7 flex-1 rounded-md border border-[var(--border)] bg-white px-2 text-[9px] leading-7 text-[var(--muted)]">
                  Search UPC, name, price…
                </div>
                <div className="h-7 w-16 rounded-md border border-[var(--border)] bg-white text-center text-[9px] leading-7 text-[var(--muted)]">
                  Dept
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-white">
                <div className="grid grid-cols-[1.4fr_0.55fr_0.7fr_0.55fr] gap-1 border-b border-[var(--border)] bg-slate-50 px-2 py-1.5 text-[8px] font-bold uppercase tracking-wide text-[var(--muted)]">
                  <span>Item</span>
                  <span>Retail</span>
                  <span>Best Vendor</span>
                  <span>Cost</span>
                </div>
                {[
                  ["Coca-Cola 12pk 12oz", "$12.99", "Costco", "$8.99"],
                  ["Red Bull 24pk 8.4oz", "$54.99", "Costco", "$38.99"],
                  ["Marlboro Gold carton", "$89.99", "Local Distributor", "$72.40"],
                  ["Doritos Nacho 9.25oz", "$5.49", "Sam's Club", "$3.80"]
                ].map(([name, sell, vendor, cost]) => (
                  <div
                    key={name}
                    className="grid grid-cols-[1.4fr_0.55fr_0.7fr_0.55fr] gap-1 border-b border-[var(--border)] px-2 py-1.5 last:border-0"
                  >
                    <span className="truncate text-[9px] font-semibold text-[var(--foreground)]">{name}</span>
                    <span className="text-[9px] font-bold text-[var(--foreground)]">{sell}</span>
                    <span className="truncate text-[9px] text-[var(--muted)]">{vendor}</span>
                    <span className="text-[9px] font-bold text-[var(--sd-green)]">{cost}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Base / hinge */}
      <div className="mx-auto h-3 w-[96%] rounded-b-md bg-gradient-to-b from-slate-300 to-slate-400" />
      <div className="mx-auto h-2 w-[34%] rounded-b-full bg-slate-400/80" />
    </motion.div>
  );
}

export function PhoneMock() {
  return (
    <motion.div
      className="relative w-[176px] shrink-0"
      initial={{ opacity: 0, y: 48, x: 16 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="rounded-[2rem] border-[5px] border-slate-800 bg-slate-900 p-1 shadow-2xl shadow-emerald-500/20"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="overflow-hidden rounded-[1.55rem] bg-white">
          {/* Status / notch */}
          <div className="relative bg-[var(--surface)] px-3 pb-1 pt-2.5">
            <div className="absolute left-1/2 top-1.5 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-900" />
            <div className="flex items-center justify-between text-[8px] font-semibold text-[var(--muted)]">
              <span>9:41</span>
              <span>LTE · 84%</span>
            </div>
          </div>

          <div className="space-y-2.5 px-3 pb-3.5 pt-2">
            <div className="flex items-center gap-2">
              <Image
                src="/brand/logo-mark.jpg"
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] rounded object-cover"
              />
              <div>
                <div className="text-[10px] font-bold leading-tight text-[var(--foreground)]">StoreDesk Mobile</div>
                <div className="text-[8px] text-[var(--sd-green)]">Store Connected</div>
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-[#1A63F4] to-[#00A87B] p-3 text-white shadow-md">
              <div className="text-[8px] uppercase tracking-wider text-white/80">Scan Result</div>
              <div className="mt-0.5 text-[12px] font-bold">Coca-Cola</div>
              <div className="text-[9px] text-white/85">12 Pack · 12 oz cans</div>
              <div className="mt-2.5 flex items-end justify-between">
                <div>
                  <div className="text-[8px] uppercase tracking-wider text-white/75">Best Vendor</div>
                  <div className="text-[13px] font-extrabold leading-tight">Costco</div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-white/75">Case</div>
                  <div className="text-[15px] font-extrabold">$8.99</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2">
                <div className="text-[8px] text-[var(--muted)]">Per item</div>
                <div className="text-[12px] font-bold text-[var(--foreground)]">$0.75</div>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2">
                <div className="text-[8px] text-[var(--muted)]">Suggested</div>
                <div className="text-[12px] font-bold text-[var(--sd-green)]">$12.99</div>
              </div>
            </div>

            <div className="rounded-xl bg-[var(--sd-blue)] py-2 text-center text-[10px] font-bold text-white">
              Scan Barcode
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function DeviceStage() {
  return (
    <div className="relative flex min-h-[280px] items-end justify-center pb-2 md:min-h-[320px]">
      <div className="pointer-events-none absolute -inset-8 rounded-full bg-[radial-gradient(circle_at_center,rgba(26,99,244,0.14),transparent_65%)] blur-2xl" />
      <LaptopMock />
      <div className="absolute -right-1 bottom-4 z-10 sm:-right-4 md:-right-8 md:bottom-6">
        <PhoneMock />
      </div>
    </div>
  );
}
