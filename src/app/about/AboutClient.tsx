"use client";

import { MarketingShell } from "@/components/MarketingShell";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { SITE, contactMailto } from "@/lib/site";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import { HeartHandshake, Lock, Scale, Sparkles, Users } from "lucide-react";

const PRINCIPLES = [
  { subject: "Store Computer", score: 98 },
  { subject: "Review First", score: 92 },
  { subject: "No Stock Counts", score: 100 },
  { subject: "Mobile Speed", score: 88 },
  { subject: "Store Engine", score: 96 },
  { subject: "Register Sync", score: 90 }
];

export function AboutClient() {
  return (
    <MarketingShell eyebrow="About" title="Why we built StoreDesk — for convenience store operators">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
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
              Convenience store owners deal with thousands of items, rising supplier prices, and stacks of paper invoices. 
              What they need is a clear system to track cost truth, calculate proper selling prices, and scan barcodes on the floor.
            </p>
            <p className="mt-4 text-[var(--muted)] leading-relaxed">
              Created by the StoreDesk team, StoreDesk runs on your store computer with a desktop dashboard for management and a fast mobile app for floor staff — keeping all your pricing data fast, local, and accurate.
            </p>
            <div className="mt-5">
              <VerifoneBadge />
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#eef4ff] to-[#e8faf3] p-6"
          >
            <div className="mb-3 flex items-center gap-2 text-[var(--sd-green)]">
              <Users className="h-5 w-5" />
              <h2 className="text-lg font-bold text-[var(--foreground)]">Get in touch</h2>
            </div>
            <p className="text-[var(--muted)] leading-relaxed">
              Built by convenience store operations specialists who understand retail pricing, vendor invoices, and register management.
            </p>
            <a href={contactMailto()} className="mt-4 inline-flex items-center gap-2 font-semibold text-[var(--sd-blue)] hover:underline">
              <HeartHandshake className="h-4 w-4" />
              {SITE.email}
            </a>
          </motion.section>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white/95 p-5 shadow-md">
          <div className="mb-2 flex items-center gap-2">
            <Scale className="h-5 w-5 text-[var(--sd-blue)]" />
            <h2 className="font-bold">Product Principles</h2>
          </div>
          <p className="mb-4 text-xs text-[var(--muted)]">Our core focus areas for store operations.</p>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={PRINCIPLES} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="rgba(14,67,216,0.2)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#4f5d73" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Focus" dataKey="score" stroke="#1A63F4" fill="#00A87B" fillOpacity={0.35} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-2 text-sm text-[var(--muted)]">
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--sd-green)]" /> All store records stay securely on your computer
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--sd-blue)]" /> Human review of vendor invoices before updating prices
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--sd-blue)]" /> Dedicated price book and supplier cost comparison
            </li>
            <li className="flex items-center gap-2">Fast barcode scanning for floor staff</li>
          </ul>
          <Link href="/how-it-works" className="mt-6 inline-block text-sm font-bold text-[var(--sd-blue)]">
            See how it works →
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
