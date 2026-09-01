"use client";

import { MarketingShell } from "@/components/MarketingShell";

import { VerifoneBadge } from "@/components/VerifoneBadge";
import { motion } from "framer-motion";
import {
  HardDrive,
  Laptop,
  Server,
  Smartphone,
  Download
} from "lucide-react";


const steps = [
  {
    title: "Step 1: Install StoreDesk Worker",
    detail: "Download and run the StoreDesk Worker installer on your back-office Windows PC. It starts a local Node.js server and MongoDB database — no internet required after setup.",
    icon: Download
  },
  {
    title: "Step 2: Build Your Price Book",
    detail: "Open StoreDesk Desktop and add your products, product variants, and vendors. Enter the prices each vendor charges per pack, case, or unit. StoreDesk calculates your true cost per item automatically.",
    icon: Laptop
  },
  {
    title: "Step 3: Walk the Floor with StoreDesk Mobile",
    detail: "Log in from any Android phone on your store Wi-Fi. Scan shelf barcodes to see your vendor cost, suggested selling price, and which supplier has the best deal — right where you need it.",
    icon: Smartphone
  }
];

export function HowItWorksClient() {
  return (
    <MarketingShell title="How StoreDesk powers your store">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] p-2.5 text-white shadow-md">
            <HardDrive className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-bold">Your Store. Your Computer.</p>
            <p className="text-xs text-[var(--muted)]">StoreDesk Worker + Desktop + Mobile App + Cloud Hub</p>
          </div>
        </div>
        <VerifoneBadge />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Server, label: "StoreDesk Worker", sub: "Local Server & Database" },
          { icon: Laptop, label: "StoreDesk Desktop", sub: "Price Book & Vendor Hub" },
          { icon: Smartphone, label: "StoreDesk Mobile", sub: "Barcode Floor Scanner" },
          { icon: HardDrive, label: "Cloud Hub", sub: "License & Account Sync" }
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

      <h2 className="mt-12 text-xl font-bold">1-2-3 Setup</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Get up and running in less than 15 minutes without calling IT.
      </p>
      <ol className="mt-12 space-y-4">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.li
              key={step.title}
              className="relative flex gap-6 pb-8 last:pb-0"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              {i !== steps.length - 1 && (
                <div className="absolute left-6 top-12 bottom-0 w-px bg-gradient-to-b from-[var(--sd-blue)]/50 to-transparent" />
              )}
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1A63F4] to-[#00A87B] text-white shadow-md">
                <Icon className="h-5 w-5" />
              </span>
              <div className="rounded-2xl border border-[var(--border)] bg-white/95 p-5 shadow-sm w-full">
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
