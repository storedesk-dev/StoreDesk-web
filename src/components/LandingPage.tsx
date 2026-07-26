"use client";

import Image from "next/image";
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
  {
    n: "01",
    title: "Install on the store PC",
    body: "Run StoreDesk Worker + Desktop locally. Connect to Verifone Commander for live PLUs."
  },
  {
    n: "02",
    title: "License the store",
    body: "We issue STORE_ID + AGENT_KEY with a support period (trial or custom end date)."
  },
  {
    n: "03",
    title: "Pair Mobile",
    body: "Phone joins over LAN today; Cloud Hub relay is next so you are not stuck on the same Wi‑Fi forever."
  },
  {
    n: "04",
    title: "Operate daily",
    body: "Scan, compare costs, review invoices, and push confirmed vendor prices — never auto-stock counts."
  }
];

export function LandingPage() {
  const parallaxRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <div className="bg-white text-[var(--foreground)]">
      <div className="relative overflow-hidden bg-[var(--surface)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-1/4 top-0 h-[50vh] w-[60vw] rounded-full bg-[radial-gradient(circle,rgba(26,99,244,0.12),transparent_70%)]" />
          <div className="absolute -right-1/4 top-1/3 h-[45vh] w-[55vw] rounded-full bg-[radial-gradient(circle,rgba(0,168,123,0.1),transparent_70%)]" />
        </div>
        <SiteHeader />

        <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-2 lg:pb-24">
          <div>
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Image
                src="/brand/logo-mark.svg"
                alt=""
                width={88}
                height={88}
                priority
                className="h-[88px] w-[88px]"
              />
            </motion.div>
            <motion.p
              className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-green)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Convenience · Gas · C-store ops
            </motion.p>
            <motion.h1
              className="text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              Built for the counter — not the warehouse
            </motion.h1>
            <motion.p
              className="mt-5 max-w-md text-lg leading-relaxed text-[var(--muted)]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Price books, vendor costs, invoice review, and mobile scanning for stores that run Verifone Commander.
              Licenses in the cloud. Truth on the store PC.
            </motion.p>
            <motion.div
              className="mt-8 flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Link
                href="/how-it-works"
                className="rounded-full bg-[var(--sd-blue)] px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-[var(--sd-blue-shadow)]"
              >
                How it works
              </Link>
              <Link
                href="/contact"
                className="rounded-full border border-[var(--border)] bg-white px-6 py-3 text-sm font-bold text-[var(--foreground)] hover:border-[var(--sd-blue)]"
              >
                Contact us
              </Link>
            </motion.div>
          </div>
          <DeviceStage />
        </section>
      </div>

      <section className="relative border-t border-[var(--border)]">
        <div className="mx-auto grid max-w-6xl md:grid-cols-[280px_1fr]">
          <div className="hidden md:block">
            <div className="sticky top-24 px-6 py-24">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-green)]">The idea</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Why StoreDesk exists</h2>
            </div>
          </div>
          <div className="space-y-16 px-6 py-16 md:border-l md:border-[var(--border)] md:px-12 md:py-20">
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
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-15%" }}
                transition={{ duration: 0.45, delay: i * 0.04 }}
              >
                <h3 className="text-2xl font-bold">{block.t}</h3>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-[var(--muted)]">{block.b}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--surface)] py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-green)]">Product</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Three surfaces. One system.</h2>
        </div>
        <div className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 md:mx-auto md:max-w-6xl">
          {pillars.map((p, i) => (
            <motion.article
              key={p.title}
              className="w-[85%] shrink-0 snap-center rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm md:w-[340px]"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
            >
              <div className="mb-4 h-1 w-12 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B]" />
              <h3 className="text-xl font-bold">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{p.body}</p>
            </motion.article>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-6xl px-6">
          <Link href="/product" className="text-sm font-bold text-[var(--sd-blue)] hover:underline">
            Full product tour →
          </Link>
        </div>
      </section>

      <section ref={parallaxRef} className="relative overflow-hidden border-t border-[var(--border)] py-24">
        <motion.div style={{ y }} className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
          <Image src="/brand/logo-mark.svg" alt="" width={280} height={280} className="h-64 w-64 md:h-72 md:w-72" />
        </motion.div>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Not an inventory system.</h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--muted)]">
            No on-hand counts. No reorder alerts. No warehouse bins. StoreDesk is for prices, vendors, invoices, and the
            people standing at the register.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-green)]">How it works</p>
          <h2 className="mt-2 text-3xl font-bold">From install to daily ops</h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-2">
            {steps.map((s, i) => (
              <motion.li
                key={s.n}
                className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="font-mono text-sm font-semibold text-[var(--sd-blue)]">{s.n}</span>
                <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{s.body}</p>
              </motion.li>
            ))}
          </ol>
          <Link href="/how-it-works" className="mt-8 inline-block text-sm font-bold text-[var(--sd-blue)]">
            Deeper walkthrough →
          </Link>
        </div>
      </section>

      <section className="border-t border-[var(--border)] px-6 py-20">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-8 py-12 text-center">
          <Image src="/brand/logo-lockup-horizontal.svg" alt="StoreDesk" width={200} height={42} className="mx-auto h-10 w-auto" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight">Talk to us about a store license</h2>
          <p className="mt-4 text-[var(--muted)]">
            Trials and custom support end-dates are set per store. Email{" "}
            <a className="font-semibold text-[var(--sd-blue)] underline" href={`mailto:${SITE.email}`}>
              {SITE.email}
            </a>
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="rounded-full bg-[var(--sd-blue)] px-6 py-3 text-sm font-bold text-white hover:bg-[var(--sd-blue-shadow)]"
            >
              Contact
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-full border border-[var(--border)] bg-white px-6 py-3 text-sm font-bold"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
