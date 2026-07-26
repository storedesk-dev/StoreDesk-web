"use client";

import Image from "next/image";
import { motion } from "framer-motion";

/** Desktop chrome mock — Price Book vibe (product UI chrome on light marketing page) */
export function LaptopMock() {
  return (
    <motion.div
      className="relative w-full max-w-[520px]"
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="rounded-t-xl border border-[var(--border)] bg-white p-2 shadow-xl shadow-blue-500/10">
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
          <span className="ml-3 h-5 flex-1 rounded-md bg-[var(--surface)] pl-2 text-[10px] leading-5 text-[var(--muted)]">
            StoreDesk · Price Book
          </span>
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <aside className="space-y-2 bg-gradient-to-b from-[#0E43D8] to-[#00A87B] p-2">
            <Image src="/brand/logo-mark.svg" alt="" width={24} height={24} className="h-6 w-6 brightness-0 invert" />
            {["POS", "Book", "Cost", "Set"].map((l) => (
              <div key={l} className="rounded px-1 py-1 text-[9px] font-semibold text-white/90">
                {l}
              </div>
            ))}
          </aside>
          <div className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="h-6 w-16 rounded-md bg-[var(--sd-blue)]" />
            </div>
            <div className="space-y-1.5">
              {[
                ["Coca-Cola 12pk", "$8.99", "Costco"],
                ["Red Bull 24pk", "$38.99", "Costco"],
                ["Marlboro Gold", "$72.40", "Local"]
              ].map(([name, price, vendor]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-md border border-[var(--border)] bg-white px-2 py-1.5"
                >
                  <div>
                    <div className="text-[10px] font-semibold text-[var(--foreground)]">{name}</div>
                    <div className="text-[9px] text-[var(--muted)]">{vendor}</div>
                  </div>
                  <div className="text-[11px] font-bold text-[var(--sd-green)]">{price}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto h-3 w-[92%] rounded-b-md border border-t-0 border-[var(--border)] bg-slate-100" />
      <div className="mx-auto h-1.5 w-[28%] rounded-b-full bg-slate-200" />
    </motion.div>
  );
}

export function PhoneMock() {
  return (
    <motion.div
      className="relative w-[168px] shrink-0"
      initial={{ opacity: 0, y: 48, x: 16 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="rounded-[28px] border-[3px] border-slate-300 bg-white p-2 shadow-xl shadow-emerald-500/15"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="overflow-hidden rounded-[22px] bg-[var(--surface)]">
          <div className="flex justify-center py-2">
            <div className="h-4 w-16 rounded-full bg-slate-200" />
          </div>
          <div className="space-y-3 px-3 pb-4 pt-1">
            <div className="flex items-center gap-2">
              <Image src="/brand/logo-mark.svg" alt="" width={20} height={20} className="h-5 w-5" />
              <div className="text-[10px] font-bold tracking-wide text-[var(--muted)]">STOREDESK MOBILE</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-[#1A63F4] to-[#00A87B] p-3 text-white">
              <div className="text-[11px] font-bold">Coca-Cola</div>
              <div className="text-[9px] text-white/85">12 Pack · 12 oz</div>
              <div className="mt-2 text-[9px] uppercase tracking-wider text-white/75">Best vendor</div>
              <div className="text-sm font-extrabold">Costco · $8.99</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-white px-2 py-2">
              <div className="text-[9px] text-[var(--muted)]">Suggested sell</div>
              <div className="text-lg font-extrabold text-[var(--sd-green)]">$12.99</div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function DeviceStage() {
  return (
    <div className="relative flex items-end justify-center gap-2 md:gap-4">
      <div className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_center,rgba(26,99,244,0.12),transparent_65%)] blur-xl" />
      <LaptopMock />
      <div className="absolute -right-2 bottom-6 z-10 md:-right-6 md:bottom-8">
        <PhoneMock />
      </div>
    </div>
  );
}
