"use client";

import { motion } from "framer-motion";

/** Desktop chrome mock — Price Book vibe */
export function LaptopMock() {
  return (
    <motion.div
      className="relative w-full max-w-[520px]"
      initial={{ opacity: 0, y: 40, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      style={{ transformStyle: "preserve-3d" }}
    >
      <div className="rounded-t-xl border border-white/15 bg-[#0c0e12] p-2 shadow-[0_0_60px_rgba(26,99,244,0.25)]">
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
          <span className="ml-3 h-5 flex-1 rounded-md bg-white/5 text-[10px] leading-5 text-white/30 pl-2">
            StoreDesk · Price Book
          </span>
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-2 overflow-hidden rounded-lg bg-[#11141a]">
          <aside className="space-y-2 bg-gradient-to-b from-[#0E43D8] to-[#00A87B] p-2">
            <div className="h-6 w-6 rounded-md bg-white/90" />
            {["POS", "Book", "Cost", "Set"].map((l) => (
              <div key={l} className="rounded px-1 py-1 text-[9px] font-semibold text-white/80">
                {l}
              </div>
            ))}
          </aside>
          <div className="space-y-2 p-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded bg-white/20" />
              <div className="h-6 w-16 rounded-md bg-[var(--sd-blue)]/80" />
            </div>
            <div className="space-y-1.5">
              {[
                ["Coca-Cola 12pk", "$8.99", "Costco"],
                ["Red Bull 24pk", "$38.99", "Costco"],
                ["Marlboro Gold", "$72.40", "Local"]
              ].map(([name, price, vendor]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.03] px-2 py-1.5"
                >
                  <div>
                    <div className="text-[10px] font-semibold text-white/90">{name}</div>
                    <div className="text-[9px] text-white/40">{vendor}</div>
                  </div>
                  <div className="text-[11px] font-bold text-[var(--sd-mint)]">{price}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto h-3 w-[92%] rounded-b-md bg-[#1a1d24] border border-t-0 border-white/10" />
      <div className="mx-auto h-1.5 w-[28%] rounded-b-full bg-[#2a2e38]" />
    </motion.div>
  );
}

/** Phone chrome mock — StoreDesk Mobile scan result */
export function PhoneMock() {
  return (
    <motion.div
      className="relative w-[168px] shrink-0"
      initial={{ opacity: 0, y: 60, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="rounded-[28px] border-[3px] border-white/20 bg-black p-2 shadow-[0_20px_50px_rgba(0,168,123,0.35)]"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="overflow-hidden rounded-[22px] bg-[#0a0c10]">
          <div className="flex justify-center py-2">
            <div className="h-4 w-16 rounded-full bg-black" />
          </div>
          <div className="space-y-3 px-3 pb-4 pt-1">
            <div className="text-[10px] font-bold tracking-wide text-white/50">STOREDESK MOBILE</div>
            <div className="rounded-xl bg-gradient-to-br from-[#1A63F4] to-[#00A87B] p-3">
              <div className="text-[11px] font-bold text-white">Coca-Cola</div>
              <div className="text-[9px] text-white/80">12 Pack · 12 oz</div>
              <div className="mt-2 text-[9px] uppercase tracking-wider text-white/70">Best vendor</div>
              <div className="text-sm font-extrabold text-white">Costco · $8.99</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
              <div className="text-[9px] text-white/45">Suggested sell</div>
              <div className="text-lg font-extrabold text-[var(--sd-mint)]">$12.99</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded-lg bg-white/10 py-2 text-center text-[9px] font-bold text-white">Scan</div>
              <div className="rounded-lg bg-[var(--sd-blue)] py-2 text-center text-[9px] font-bold text-white">
                Prices
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function DeviceStage() {
  return (
    <div className="relative flex items-end justify-center gap-2 md:gap-4 perspective-[1200px]">
      <div className="pointer-events-none absolute -inset-8 rounded-full bg-[radial-gradient(circle_at_center,rgba(26,99,244,0.35),transparent_65%)] blur-2xl" />
      <LaptopMock />
      <div className="absolute -right-2 bottom-6 z-10 md:-right-6 md:bottom-8">
        <PhoneMock />
      </div>
    </div>
  );
}
