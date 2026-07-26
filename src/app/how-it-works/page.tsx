"use client";

import { MarketingShell } from "@/components/MarketingShell";
import { motion } from "framer-motion";

const flow = [
  { title: "Edge install", detail: "Store PC runs MongoDB (local), StoreDesk Worker on port 4310, and the Electron desktop." },
  { title: "Commander stays local", detail: "Price Book and reports talk to Verifone Commander on the store network — read-only where required." },
  { title: "License from the web", detail: "We create a store license with STORE_ID, AGENT_KEY, and a support end date (trial or custom)." },
  { title: "Mobile on Wi‑Fi", detail: "StoreDesk Mobile pairs to the LAN URL today. Cloud Hub will relay rooms without exposing Mongo." },
  { title: "Invoice → review → price", detail: "Extractions lines are never auto-saved as vendor prices. Humans confirm first." }
];

export default function HowItWorksPage() {
  return (
    <MarketingShell eyebrow="How it works" title="Architecture you can explain in one whiteboard">
      <div className="relative">
        {flow.map((step, i) => (
          <motion.div
            key={step.title}
            className="relative grid gap-4 border-l border-[var(--border)] py-8 pl-8 md:grid-cols-[200px_1fr]"
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ delay: i * 0.06 }}
          >
            <div className="absolute -left-1.5 top-10 h-3 w-3 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B]" />
            <h2 className="text-lg font-bold text-[var(--foreground)]">{step.title}</h2>
            <p className="text-[var(--muted)] leading-relaxed">{step.detail}</p>
          </motion.div>
        ))}
      </div>
      <pre className="mt-10 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 font-mono text-xs leading-relaxed text-[var(--foreground)]">
{`StoreDesk Mobile / Desktop
        │
        ▼
   Cloud Hub (WSS)  ──►  Edge Agent on store PC  ──►  local Mongo + Commander
        │
   StoreDesk Web (licenses only) ──► Atlas M0`}
      </pre>
    </MarketingShell>
  );
}
