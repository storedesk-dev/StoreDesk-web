"use client";

import { MarketingShell } from "@/components/MarketingShell";
import { VendorCostChart } from "@/components/VendorCostChart";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { motion } from "framer-motion";
import {
  BarChart3,
  FileSearch,
  HardDrive,
  Receipt,
  ScanBarcode,
  Smartphone
} from "lucide-react";

const features = [
  {
    title: "Price Book",
    body: "Live Verifone Commander PLUs with local vendor cost overlays. Search by name, UPC, or price.",
    icon: BarChart3,
    accent: "from-[#1A63F4] to-[#4f8cff]"
  },
  {
    title: "Cost Analysis",
    body: "Compare sell vs vendor cost so true margin is visible before you change a shelf price.",
    icon: FileSearch,
    accent: "from-[#00A87B] to-[#28C88B]"
  },
  {
    title: "Invoice review",
    body: "Upload → extract → human review → confirmed VendorPrice history. Never silent overwrite.",
    icon: Receipt,
    accent: "from-[#1A63F4] to-[#00A87B]"
  },
  {
    title: "POS Reports",
    body: "Ruby reports and T-Log pulls from Commander for the days that matter at close.",
    icon: HardDrive,
    accent: "from-[#0E43D8] to-[#1A63F4]"
  },
  {
    title: "StoreDesk Mobile",
    body: "Scan, best vendor badge, suggested sell, invoice photo upload — built for the aisle.",
    icon: Smartphone,
    accent: "from-[#00A87B] to-[#1A63F4]"
  },
  {
    title: "Scan-first lookup",
    body: "UPC and internal codes resolve to best cost and suggested sell without typing a novel.",
    icon: ScanBarcode,
    accent: "from-[#28C88B] to-[#00A87B]"
  }
];

export default function ProductPage() {
  return (
    <MarketingShell eyebrow="Product" title="Everything at the counter — nothing for stock counts">
      <div className="flex flex-wrap items-center gap-4">
        <VerifoneBadge />
        <p className="max-w-xl text-[var(--muted)]">
          Worker on the backoffice PC, Electron desktop, and StoreDesk Mobile — live PLUs from Commander with vendor
          costs you review.
        </p>
      </div>

      <div className="mt-10">
        <VendorCostChart />
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.article
              key={f.title}
              className="group rounded-2xl border border-[var(--border)] bg-white/95 p-6 shadow-md shadow-blue-500/5 transition hover:-translate-y-0.5 hover:shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <div
                className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${f.accent} p-2.5 text-white shadow-sm`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <h2 className="text-lg font-bold">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{f.body}</p>
            </motion.article>
          );
        })}
      </div>

      <div className="mt-14 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 p-8">
        <h2 className="text-2xl font-extrabold text-amber-950">Explicitly out of scope</h2>
        <p className="mt-3 text-amber-950/70">
          Stock quantity, low-stock alerts, reorder levels, warehouse locations, and inventory adjustments are not
          StoreDesk. If you need a WMS, use a WMS — we stay focused on price truth.
        </p>
      </div>
    </MarketingShell>
  );
}
