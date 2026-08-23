"use client";

import { MarketingShell } from "@/components/MarketingShell";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { SITE, contactMailto } from "@/lib/site";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  HeartHandshake,
  HardDrive,
  Scan,
  BarChart3,
  ShieldCheck,
  DollarSign,
  Sparkles,
  Users
} from "lucide-react";

const WHAT_IT_DOES = [
  {
    icon: HardDrive,
    title: "Runs on your PC",
    body: "StoreDesk Worker runs on your back-office Windows PC. All product data, vendor prices, and pricing rules stay on your hardware — not in a shared cloud.",
    color: "bg-[#1A63F4]"
  },
  {
    icon: BarChart3,
    title: "Vendor cost comparison",
    body: "Add your vendors and their prices per pack or case. StoreDesk calculates the true cost per unit so you always know which supplier gives you the best deal.",
    color: "bg-[#00A87B]"
  },
  {
    icon: Scan,
    title: "Floor barcode scanning",
    body: "StoreDesk Mobile lets any staff member scan a shelf barcode and instantly see the vendor cost, suggested price, and margin — on their phone over store Wi-Fi.",
    color: "bg-[#1A63F4]"
  },
  {
    icon: DollarSign,
    title: "Margin & markup rules",
    body: "Set pricing rules by product, category, or the whole store. StoreDesk calculates a suggested selling price using your margin % or markup % and rounds it cleanly.",
    color: "bg-[#00A87B]"
  },
  {
    icon: ShieldCheck,
    title: "No stock counts",
    body: "StoreDesk is not an inventory system. It does not track stock quantities, reorder levels, or warehouse movements. It focuses entirely on pricing and vendor costs.",
    color: "bg-[#1A63F4]"
  }
];

export function AboutClient() {
  return (
    <MarketingShell eyebrow="About" title="Why we built StoreDesk — for convenience store operators">
      <div className="space-y-10">

        {/* Origin story */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[var(--border)] bg-white/95 p-6 shadow-md"
        >
          <div className="mb-3 flex items-center gap-2 text-[var(--sd-blue)]">
            <Sparkles className="h-5 w-5" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">Why StoreDesk was built</h2>
          </div>
          <p className="text-[var(--muted)] leading-relaxed">
            Most convenience store software focuses on inventory counts or POS management.
            StoreDesk fills the gap between what your register shows and what you actually paid your vendor
            — a gap that quietly erodes margins every time a supplier raises their prices.
          </p>
          <p className="mt-4 text-[var(--muted)] leading-relaxed">
            StoreDesk runs entirely on your store computer. The desktop dashboard handles your full price book
            and vendor cost comparisons. StoreDesk Mobile puts that data in your pocket on the floor
            — scan any barcode, see your true cost and margin, and know instantly which vendor to reorder from.
          </p>
          <div className="mt-5">
            <VerifoneBadge />
          </div>
        </motion.section>

        {/* What it actually does */}
        <div>
          <h2 className="mb-6 text-xl font-bold text-[var(--foreground)]">What StoreDesk does</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WHAT_IT_DOES.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="rounded-2xl border border-[var(--border)] bg-white/95 p-5 shadow-sm"
                >
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${item.color} text-white shadow-sm`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="mt-3 text-sm font-bold text-[var(--foreground)]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{item.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Contact */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#eef4ff] to-[#e8faf3] p-6"
        >
          <div className="mb-3 flex items-center gap-2 text-[var(--sd-green)]">
            <Users className="h-5 w-5" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">Get in touch</h2>
          </div>
          <p className="text-[var(--muted)] leading-relaxed">
            Have a question about setup, Commander compatibility, or pricing? We answer every email.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <a href={contactMailto()} className="inline-flex items-center gap-2 font-semibold text-[var(--sd-blue)] hover:underline">
              <HeartHandshake className="h-4 w-4" />
              {SITE.email}
            </a>
            <Link href="/how-it-works" className="text-sm font-bold text-[var(--sd-blue)] hover:underline">
              See how it works →
            </Link>
          </div>
        </motion.section>

      </div>
    </MarketingShell>
  );
}
