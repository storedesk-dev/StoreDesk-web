"use client";

import { MarketingShell } from "@/components/MarketingShell";
import { motion } from "framer-motion";

const features = [
  {
    title: "Price Book",
    body: "Live Verifone Commander PLUs with local vendor cost overlays. Search by name, UPC, or price."
  },
  {
    title: "Cost Analysis",
    body: "Compare sell vs vendor cost so true margin is visible before you change a shelf price."
  },
  {
    title: "Invoice review",
    body: "Upload → extract → human review → confirmed VendorPrice history. Never silent overwrite."
  },
  {
    title: "POS Reports & Transactions",
    body: "Ruby reports and T-Log pulls from Commander for the days that matter at close."
  },
  {
    title: "StoreDesk Mobile",
    body: "Scan, best vendor badge, suggested sell, invoice photo upload — built for the aisle."
  },
  {
    title: "Cloud Hub (roadmap)",
    body: "Outbound WSS rooms so Desktop and Mobile can reach the store without being stuck on LAN forever."
  }
];

export default function ProductPage() {
  return (
    <MarketingShell eyebrow="Product" title="Everything at the counter — nothing for stock counts">
      <p className="max-w-2xl text-lg text-[var(--muted)]">
        StoreDesk is a local-first desktop plus phone system for convenience stores and gas stations. The cloud piece
        is licensing and connectivity — not your catalog.
      </p>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {features.map((f, i) => (
          <motion.article
            key={f.title}
            className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
          >
            <h2 className="text-xl font-bold">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{f.body}</p>
          </motion.article>
        ))}
      </div>
      <div className="mt-14 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[#1A63F4]/20 to-[#00A87B]/20 p-8">
        <h2 className="text-2xl font-extrabold">Explicitly out of scope</h2>
        <p className="mt-3 text-[var(--muted)]">
          Stock quantity, low-stock alerts, reorder levels, warehouse locations, and inventory adjustments are not
          StoreDesk. If you need a WMS, use a WMS — we stay focused on price truth.
        </p>
      </div>
    </MarketingShell>
  );
}
