"use client";

import { MarketingShell } from "@/components/MarketingShell";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { motion } from "framer-motion";
import {
  HardDrive,
  Laptop,
  MonitorSmartphone,
  Server,
  ShieldCheck,
  Smartphone,
  Download
} from "lucide-react";

const ARCH = `flowchart TB
  subgraph Backoffice["Backoffice PC"]
    WORK["StoreDesk Worker<br/>:4310 backend"]
    DESK["StoreDesk Desktop<br/>Electron"]
    MONGO[("Local database")]
    CMD["Verifone<br/>Commander"]
    DESK --> WORK
    WORK --> MONGO
    WORK --> CMD
  end

  MOB["StoreDesk Mobile<br/>phone on store Wi‑Fi"]
  MOB -->|LAN → Worker| WORK`;

const steps = [
  {
    title: "Run Worker on the backoffice PC",
    detail: "Worker is your local backend on port 4310. Desktop and Mobile connect here.",
    icon: Download
  },
  {
    title: "Run StoreDesk Desktop",
    detail: "Electron connects to Worker for Price Book, Cost Analysis, POS Reports, invoices, and vendors.",
    icon: Laptop
  },
  {
    title: "Connect to Verifone Commander",
    detail: "Live PLUs and Ruby reports stay on the store network — Worker talks to Commander; phones never do.",
    icon: MonitorSmartphone
  },
  {
    title: "Sign in & Connect StoreDesk Mobile",
    detail: "Sign in with your Organization AppUser, join store Wi‑Fi, and connect directly to the backoffice PC’s Worker API.",
    icon: Smartphone
  },
  {
    title: "Invoice → review → price",
    detail: "Extracted lines are never auto-saved as vendor prices. Humans confirm first.",
    icon: ShieldCheck
  }
];

export default function HowItWorksPage() {
  return (
    <MarketingShell eyebrow="How it works" title="What runs on your backoffice PC">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] p-2.5 text-white shadow-md">
            <HardDrive className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-bold">Your store. Your PC.</p>
            <p className="text-xs text-[var(--muted)]">Worker + Desktop + Mobile + local backend</p>
          </div>
        </div>
        <VerifoneBadge />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Server, label: "Worker", sub: "Backend · :4310" },
          { icon: Laptop, label: "Desktop", sub: "Electron app" },
          { icon: Smartphone, label: "Mobile", sub: "Floor scanning" },
          { icon: HardDrive, label: "Backend", sub: "Local on PC" }
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/90 p-4 shadow-sm"
            >
              <Icon className="h-8 w-8 text-[var(--sd-blue)]" />
              <div>
                <p className="font-bold">{card.label}</p>
                <p className="text-xs text-[var(--muted)]">{card.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mt-12 text-xl font-bold">System map</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Everything clients care about lives on the backoffice PC. Mobile reaches Worker over Wi‑Fi only.
      </p>
      <div className="mt-4">
        <MermaidDiagram chart={ARCH} />
      </div>

      <ol className="mt-12 space-y-4">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.li
              key={step.title}
              className="flex gap-4 rounded-2xl border border-[var(--border)] bg-white/95 p-5 shadow-sm"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1A63F4] to-[#00A87B] text-white">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--sd-blue)]">Step {i + 1}</p>
                <h3 className="text-lg font-bold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{step.detail}</p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </MarketingShell>
  );
}
