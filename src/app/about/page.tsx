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
import { GitBranch, HeartHandshake, Lock, Scale, Sparkles, Users } from "lucide-react";

const PRINCIPLES = [
  { subject: "Backoffice", score: 98 },
  { subject: "Review first", score: 92 },
  { subject: "No stock qty", score: 100 },
  { subject: "Mobile speed", score: 88 },
  { subject: "Local Worker", score: 96 },
  { subject: "Commander", score: 90 }
];

export default function AboutPage() {
  return (
    <MarketingShell eyebrow="About" title="Why we built StoreDesk — and who ships it">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[var(--border)] bg-white/95 p-6 shadow-md"
          >
            <div className="mb-3 flex items-center gap-2 text-[var(--sd-blue)]">
              <Sparkles className="h-5 w-5" />
              <h2 className="text-lg font-bold text-[var(--foreground)]">Why it was built</h2>
            </div>
            <p className="text-[var(--muted)] leading-relaxed">
              Convenience stores already have a POS brain (often Verifone Commander) and a pile of vendor invoices. What
              they lack is a calm place to reconcile sell price, vendor cost, and mobile lookup — without pretending to
              be an inventory ERP.
            </p>
            <p className="mt-4 text-[var(--muted)] leading-relaxed">
              StoreDesk is what you run on the backoffice PC: Worker (local backend), Electron desktop for daily ops,
              and StoreDesk Mobile on the floor — all talking to that same store machine.
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
              <h2 className="text-lg font-bold text-[var(--foreground)]">Who builds it</h2>
            </div>
            <p className="text-[var(--muted)] leading-relaxed">
              Built by the <strong className="text-[var(--foreground)]">storedesk-dev</strong> team — operators and
              engineers who care about c-store workflows more than generic SaaS dashboards.
            </p>
            <a href={contactMailto()} className="mt-4 inline-flex items-center gap-2 font-semibold text-[var(--sd-blue)] hover:underline">
              <HeartHandshake className="h-4 w-4" />
              {SITE.email}
            </a>
            <p className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
              <GitBranch className="h-4 w-4" />
              Open source components on{" "}
              <a href={SITE.github} className="underline">
                GitHub
              </a>
            </p>
          </motion.section>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-white/95 p-5 shadow-md">
          <div className="mb-2 flex items-center gap-2">
            <Scale className="h-5 w-5 text-[var(--sd-blue)]" />
            <h2 className="font-bold">Principle radar</h2>
          </div>
          <p className="mb-4 text-xs text-[var(--muted)]">How hard we lean into each product rule (illustrative).</p>
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
              <Lock className="h-4 w-4 text-[var(--sd-green)]" /> Worker + data stay on the store PC
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--sd-blue)]" /> Invoice review before VendorPrice
            </li>
            <li className="flex items-center gap-2">No stock quantity features</li>
            <li className="flex items-center gap-2">Phone talks only to Worker — never the DB</li>
          </ul>
          <Link href="/how-it-works" className="mt-6 inline-block text-sm font-bold text-[var(--sd-blue)]">
            See the architecture →
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
