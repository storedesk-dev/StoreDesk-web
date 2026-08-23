"use client";

import Image from "next/image";
import { MarketingShell } from "@/components/MarketingShell";
import { VendorCostChart } from "@/components/VendorCostChart";
import { motion } from "framer-motion";
import {
  BarChart3,
  FileSearch,
  HardDrive,
  History,
  Package,
  RefreshCw,
  ScanBarcode,
  Smartphone,
  Star
} from "lucide-react";

const features = [
  {
    title: "Price Book Management",
    body: "Your entire store catalog, instantly searchable. Add products and variants with UPC, pack size, and unit size. Update prices from the desktop without touching the register.",
    icon: RefreshCw,
    accent: "from-[#0E43D8] to-[#1A63F4]"
  },
  {
    title: "Vendor Cost Comparison",
    body: "Compare all your local suppliers side-by-side per product. Always know who has the cheapest wholesale price before you place your next order.",
    icon: BarChart3,
    accent: "from-[#1A63F4] to-[#4f8cff]"
  },
  {
    title: "Price History Tracking",
    body: "Every vendor price change is recorded. See how costs have shifted over time so you can catch supplier price hikes before they eat your margin.",
    icon: History,
    accent: "from-[#00A87B] to-[#28C88B]"
  },
  {
    title: "Stop Margin Bleed",
    body: "Compare your retail shelf prices against what you actually paid so you never sell at a loss again. Pricing rules enforce your minimum margin automatically.",
    icon: FileSearch,
    accent: "from-[#00A87B] to-[#28C88B]"
  },
  {
    title: "Best Vendor Badge",
    body: "The lowest-cost supplier is automatically highlighted on every product card on mobile so your staff always knows which vendor to reorder from.",
    icon: Star,
    accent: "from-[#1A63F4] to-[#00A87B]"
  },
  {
    title: "Multi-Pack Math",
    body: "Enter a case or pack price and StoreDesk automatically calculates price per item and price per base unit so you can compare a 12-pack to a 24-pack instantly.",
    icon: Package,
    accent: "from-[#0E43D8] to-[#1A63F4]"
  },
  {
    title: "StoreDesk Mobile Scanner",
    body: "Turn any Android phone into a price checker with StoreDesk Mobile. Scan shelf barcodes to instantly see what you pay, what you sell it for, and your exact profit.",
    icon: Smartphone,
    accent: "from-[#00A87B] to-[#1A63F4]"
  },
  {
    title: "Scan-First Barcode Engine",
    body: "Normalized UPC lookup strips leading zeros and handles EAN/UPC variants to immediately display wholesale cost per item and pack breakdown.",
    icon: ScanBarcode,
    accent: "from-[#28C88B] to-[#00A87B]"
  }
];

export function ProductClient() {
  return (
    <MarketingShell eyebrow="Product" title="Everything at the counter — built for real store operations">
      <div className="mt-8 grid items-center gap-6 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-slate-900 via-[#0B1F3A] to-slate-900 p-6 text-white md:grid-cols-[180px_1fr]">
        <div className="flex justify-center">
          <div className="relative h-24 w-36 overflow-hidden rounded-xl border border-white/20 bg-white/10 p-2 shadow-xl backdrop-blur-md">
            <Image
              src="/Verifone image.png"
              alt="Verifone Commander POS Integration with StoreDesk"
              width={160}
              height={100}
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

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.article
              key={f.title}
              className="group rounded-2xl border border-[var(--border)] bg-white/95 p-6 shadow-md shadow-blue-500/5 transition hover:-translate-y-0.5 hover:shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
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
    </MarketingShell>
  );
}
