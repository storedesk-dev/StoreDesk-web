"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { DeviceStage } from "@/components/DeviceStage";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { SITE } from "@/lib/site";

const pillars = [
  {
    title: "Desktop command center",
    body: "Price Book, POS reports, invoice review, and vendor cost comparison on the store PC — where the Verifone Commander lives."
  },
  {
    title: "StoreDesk Mobile",
    body: "Scan on the floor, see best vendor cost and suggested sell price. Built for one-hand speed, not a second admin desk."
  },
  {
    title: "Cloud licenses only",
    body: "Atlas holds STORE_ID, AGENT_KEY, and support windows. Catalog and Commander data stay on the edge — not in a shared cloud DB."
  }
];

const steps = [
  { n: "01", title: "Install on the store PC", body: "Run StoreDesk Worker + Desktop locally. Connect to Verifone Commander for live PLUs." },
  { n: "02", title: "License the store", body: "We issue STORE_ID + AGENT_KEY with a support period (trial or custom end date)." },
  { n: "03", title: "Pair Mobile", body: "Phone joins over LAN today; Cloud Hub relay is next so you are not stuck on the same Wi‑Fi forever." },
  { n: "04", title: "Operate daily", body: "Scan, compare costs, review invoices, and push confirmed vendor prices — never auto-stock counts." }
];

export function LandingPage() {
  const parallaxRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.4]);

  return (
    <div className="bg-[#050608] text-white">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-1/4 top-0 h-[60vh] w-[70vw] rounded-full bg-[radial-gradient(circle,rgba(14,67,216,0.45),transparent_70%)] blur-3xl" />
          <div className="absolute -right-1/4 top-1/3 h-[50vh] w-[60vw] rounded-full bg-[radial-gradient(circle,rgba(0,168,123,0.35),transparent_70%)] blur-3xl" />
        </div>
        <SiteHeader />

        <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-10 lg:grid-cols-2">
          <div>
            <motion.p
              className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--sd-mint)]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Convenience · Gas · C-store ops
            </motion.p>
            <motion.h1
              className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
              style={{ fontFamily: "var(--font-display), system-ui, sans-serif" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <span className="bg-gradient-to-r from-white via-white to-[var(--sd-mint)] bg-clip-text text-transparent">
                StoreDesk
              </span>
              <span className="mt-2 block text-white/90">built for the counter — not the warehouse</span>
            </motion.h1>
            <motion.p
              className="mt-5 max-w-md text-base leading-relaxed text-white/60 sm:text-lg"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              Price books, vendor costs, invoice review, and mobile scanning for stores that run Verifone Commander.
              Licenses in the cloud. Truth on the store PC.
            </motion.p>
            <motion.div
              className="mt-8 flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
            >
              <Link
                href="/how-it-works"
                className="rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-6 py-3 text-sm font-bold shadow-[0_0_32px_rgba(26,99,244,0.45)]"
              >
                How it works
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold backdrop-blur"
              >
                Contact us
              </Link>
            </motion.div>
          </div>
          <DeviceStage />
        </section>
      </div>

      {/* Sticky narrative */}
      <section className="relative border-t border-white/10">
        <div className="mx-auto grid max-w-6xl md:grid-cols-[280px_1fr]">
          <div className="hidden md:block">
            <div className="sticky top-24 px-6 py-24">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--sd-mint)]">The idea</p>
              <h2
                className="mt-3 text-3xl font-extrabold tracking-tight"
                style={{ fontFamily: "var(--font-display), system-ui, sans-serif" }}
              >
                Why StoreDesk exists
              </h2>
            </div>
          </div>
          <div className="space-y-24 px-6 py-20 md:border-l md:border-white/10 md:px-12">
            {[
              {
                t: "C-stores drown in spreadsheets",
                b: "Sell prices live in Commander. Costs live in invoices. Staff guess margins on the floor. StoreDesk connects those worlds without becoming another inventory-count app."
              },
              {
                t: "Cloud-everything is the wrong default",
                b: "Your PLU book and Commander connection belong on the store PC. We license the installation from Atlas — we do not hoist your catalog into a shared cloud database."
              },
              {
                t: "Mobile has to be fast",
                b: "StoreDesk Mobile is for scanning and answers: best vendor, per-unit cost, suggested sell. Not for typing novels into a tablet."
              }
            ].map((block, i) => (
              <motion.article
                key={block.t}
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-20%" }}
                transition={{ duration: 0.55, delay: i * 0.05 }}
              >
                <h3 className="text-2xl font-bold">{block.t}</h3>
                <p className="mt-3 max-w-xl text-white/55 leading-relaxed">{block.b}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* Horizontal scroll features */}
      <section className="border-t border-white/10 bg-black/40 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--sd-mint)]">Product</p>
          <h2
            className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl"
            style={{ fontFamily: "var(--font-display), system-ui, sans-serif" }}
          >
            Three surfaces. One system.
          </h2>
        </div>
        <div className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 md:mx-auto md:max-w-6xl md:px-6">
          {pillars.map((p, i) => (
            <motion.article
              key={p.title}
              className="w-[85%] shrink-0 snap-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-6 md:w-[340px]"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="mb-4 h-1 w-12 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B]" />
              <h3 className="text-xl font-bold">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/55">{p.body}</p>
            </motion.article>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-6xl px-6">
          <Link href="/product" className="text-sm font-bold text-[var(--sd-blue)] hover:underline">
            Full product tour →
          </Link>
        </div>
      </section>

      {/* Parallax band */}
      <section ref={parallaxRef} className="relative overflow-hidden border-t border-white/10 py-28">
        <motion.div style={{ y, opacity }} className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(0,168,123,0.2),transparent_50%)]" />
        </motion.div>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2
            className="text-3xl font-extrabold tracking-tight md:text-5xl"
            style={{ fontFamily: "var(--font-display), system-ui, sans-serif" }}
          >
            Not an inventory system.
          </h2>
          <p className="mt-5 text-lg text-white/55">
            No on-hand counts. No reorder alerts. No warehouse bins. StoreDesk is for prices, vendors, invoices, and
            the people standing at the register.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="border-t border-white/10 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--sd-mint)]">How it works</p>
          <h2
            className="mt-2 text-3xl font-extrabold"
            style={{ fontFamily: "var(--font-display), system-ui, sans-serif" }}
          >
            From install to daily ops
          </h2>
          <ol className="mt-12 grid gap-6 md:grid-cols-2">
            {steps.map((s, i) => (
              <motion.li
                key={s.n}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <span className="font-mono text-sm text-[var(--sd-blue)]">{s.n}</span>
                <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-white/55">{s.body}</p>
              </motion.li>
            ))}
          </ol>
          <Link href="/how-it-works" className="mt-8 inline-block text-sm font-bold text-[var(--sd-blue)]">
            Deeper walkthrough →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 bg-gradient-to-br from-[#0E43D8]/40 via-[#050608] to-[#00A87B]/25 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            className="text-3xl font-extrabold md:text-4xl"
            style={{ fontFamily: "var(--font-display), system-ui, sans-serif" }}
          >
            Talk to us about a store license
          </h2>
          <p className="mt-4 text-white/60">
            Trials and custom support end-dates are set per store. Email{" "}
            <a className="text-[var(--sd-mint)] underline" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0E43D8]"
            >
              Contact
            </Link>
            <Link href="/how-it-works" className="rounded-full border border-white/30 px-6 py-3 text-sm font-bold">
              How it works
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
