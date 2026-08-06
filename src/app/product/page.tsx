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
    body: "Live register price list overlaid with vendor wholesale costs. Easily search by product name, UPC barcode, or retail price.",
    icon: BarChart3,
    accent: "from-[#1A63F4] to-[#4f8cff]"
  },
  {
    title: "Cost & Profit Analysis",
    body: "Compare retail shelf prices against actual wholesale costs so true profit margins are clear before updating prices.",
    icon: FileSearch,
    accent: "from-[#00A87B] to-[#28C88B]"
  },
  {
    title: "Invoice Review",
    body: "Upload vendor invoices, automatically extract line items, review prices with full human control, and save vendor price history.",
    icon: Receipt,
    accent: "from-[#1A63F4] to-[#00A87B]"
  },
  {
    title: "Store Reports",
    body: "View daily sales tax breakdowns, shift insights, and key register metrics for smooth store management.",
    icon: HardDrive,
    accent: "from-[#0E43D8] to-[#1A63F4]"
  },
  {
    title: "StoreDesk Mobile",
    body: "Scan shelf barcodes, see top supplier prices, view item cost breakdowns, and get suggested retail prices directly from your phone.",
    icon: Smartphone,
    accent: "from-[#00A87B] to-[#1A63F4]"
  },
  {
    title: "Scan-First Lookup",
    body: "Scan any barcode to immediately display wholesale cost per item, pack breakdown, and recommended selling price.",
    icon: ScanBarcode,
    accent: "from-[#28C88B] to-[#00A87B]"
  }
];

export default function ProductPage() {
  return (
    <MarketingShell eyebrow="Product" title="Everything at the counter — built for real store operations">
      <div className="mt-8 grid items-center gap-6 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-slate-900 via-[#0B1F3A] to-slate-900 p-6 text-white md:grid-cols-[180px_1fr]">
        <div className="flex justify-center">
          <div className="relative h-24 w-36 overflow-hidden rounded-xl border border-white/20 bg-white/10 p-2 shadow-xl backdrop-blur-md">
            <img
              src="/Verifone image.png"
              alt="Verifone Commander POS"
              className="h-full w-full object-contain"
            />
          </div>
        </div>
        <div>
          <span className="inline-flex rounded-full bg-[#1A63F4]/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#4f8cff]">
            Hardware Integration
          </span>
          <h2 className="mt-1 text-xl font-bold md:text-2xl">Read-Only Verifone® Commander Sync</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            Safely streams live vPLUs, ruby reports, and register transaction sets without modifying POS register configurations or risking register uptime.
          </p>
        </div>
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
        <h2 className="text-2xl font-extrabold text-amber-950">Explicitly focused on pricing & profit</h2>
        <p className="mt-3 text-amber-950/70">
          Stock counts, inventory adjustments, and warehouse bin tracking are not StoreDesk. We stay 100% focused on price accuracy, supplier costs, and retail profit margins.
        </p>
      </div>
    </MarketingShell>
  );
}
