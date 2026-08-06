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
  subgraph StorePC["Store Computer"]
    ENGINE["StoreDesk Engine<br/>Store Back Office"]
    DESK["StoreDesk Desktop<br/>Admin App"]
    RECORDS[("Store Records")]
    REGISTER["Cash Register<br/>Point of Sale"]
    DESK --> ENGINE
    ENGINE --> RECORDS
    ENGINE --> REGISTER
  end

  MOB["StoreDesk Mobile<br/>Floor Phones (Store Wi‑Fi)"]
  MOB -->|Store Wi‑Fi| ENGINE`;

const steps = [
  {
    title: "Install Store Engine",
    detail: "Runs quietly on your store computer to keep your store pricing and vendor records local and fast.",
    icon: Download
  },
  {
    title: "Launch StoreDesk Desktop",
    detail: "Use the desktop dashboard for price books, supplier cost comparisons, sales reports, and invoice reviews.",
    icon: Laptop
  },
  {
    title: "Connect Cash Register",
    detail: "Live register prices stay securely on your store network for maximum speed and data privacy.",
    icon: MonitorSmartphone
  },
  {
    title: "Sign In on StoreDesk Mobile",
    detail: "Store staff sign in with secure accounts and connect over store Wi-Fi to scan shelf barcodes anywhere.",
    icon: Smartphone
  },
  {
    title: "Review Invoices & Set Prices",
    detail: "Extracted invoice line items are reviewed by store management before updating vendor cost history and selling prices.",
    icon: ShieldCheck
  }
];

export default function HowItWorksPage() {
  return (
    <MarketingShell eyebrow="How it works" title="How StoreDesk powers your store">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] p-2.5 text-white shadow-md">
            <HardDrive className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-bold">Your Store. Your Computer.</p>
            <p className="text-xs text-[var(--muted)]">Store Engine + Desktop Dashboard + Mobile App</p>
          </div>
        </div>
        <VerifoneBadge />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Server, label: "Store Engine", sub: "Back-office core" },
          { icon: Laptop, label: "Desktop Dashboard", sub: "Admin manager" },
          { icon: Smartphone, label: "Mobile App", sub: "Floor scanner" },
          { icon: HardDrive, label: "Store Computer", sub: "Local & private" }
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

      <h2 className="mt-12 text-xl font-bold">System Map</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Your price catalog and store records remain securely on your store computer. Mobile devices connect over your store Wi‑Fi.
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
