"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { DeviceStage } from "@/components/DeviceStage";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { SITE, contactMailto } from "@/lib/site";
import { HardDrive, Laptop, Server, Smartphone } from "lucide-react";

const pillars = [
  {
    title: "StoreDesk Worker",
    body: "Runs on the backoffice PC as the local backend on port 4310 — Desktop and Mobile connect here."
  },
  {
    title: "StoreDesk Desktop",
    body: "Electron app for Price Book, Cost Analysis, POS Reports, invoice review, vendors, and price comparison."
  },
  {
    title: "StoreDesk Mobile",
    body: "Scan barcodes, search products, see best vendor cost and suggested sell, upload invoices on store Wi‑Fi."
  },
  {
    title: "Local backend",
    body: "Catalog and Commander access stay on the store PC. Phones talk only to Worker — never to the database."
  }
];

const steps = [
  {
    n: "01",
    title: "Run Worker on the backoffice PC",
    body: "Start StoreDesk Worker locally (port 4310). It is the backend for Desktop, Mobile, and Commander reads."
  },
  {
    n: "02",
    title: "Open StoreDesk Desktop",
    body: "The Electron app connects to Worker on the same PC for Price Book, costs, reports, and invoice review."
  },
  {
    n: "03",
    title: "Pair StoreDesk Mobile",
    body: "Install the phone app, join store Wi‑Fi, and point it at the backoffice PC’s LAN address."
  },
  {
    n: "04",
    title: "Operate daily",
    body: "Scan, compare costs, review invoices, and save confirmed vendor prices — not stock counts."
  }
];

export function LandingPage() {
  const parallaxRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: parallaxRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <div className="text-[var(--foreground)]">
      <div className="relative overflow-hidden sd-hero-wash">
        <SiteHeader />

        <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-2 lg:pb-24">
          <div>
            <motion.p
              className="mb-3 inline-flex rounded-full bg-gradient-to-r from-[#1A63F4]/15 to-[#00A87B]/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-blue)]"
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
              Install Worker on the backoffice PC, run Desktop and Mobile against that local backend. Price Book, vendor
              costs, POS reports, and invoice review for stores on Verifone Commander.
            </motion.p>
            <motion.div
              className="mt-5 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <VerifoneBadge />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/90 px-3 py-2 text-xs font-semibold text-[var(--muted)] shadow-sm">
                <HardDrive className="h-3.5 w-3.5 text-[var(--sd-green)]" />
                Backoffice PC · local Worker
              </span>
            </motion.div>
            <motion.div
              className="mt-8 flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Link
                href="/how-it-works"
                className="rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/25 hover:brightness-105"
              >
                How it works
              </Link>
              <a
                href={contactMailto({ subject: "StoreDesk inquiry" })}
                className="rounded-full border border-[var(--border)] bg-white/90 px-6 py-3 text-sm font-bold text-[var(--foreground)] shadow-sm hover:border-[var(--sd-blue)]"
              >
                Contact us
              </a>
            </motion.div>
          </div>
          <DeviceStage />
        </section>
      </div>

      <section className="relative border-t border-[var(--border)] sd-section-blue">
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
                t: "Your backoffice PC is the hub",
                b: "Worker runs once on the office machine. Desktop and phones talk to that local backend — your catalog and Commander link stay in the store."
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

      <section className="border-t border-[var(--border)] sd-section-green py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-green)]">What you run</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Four pieces. One store system.</h2>
          <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-[var(--border)]">
              <Server className="h-4 w-4 text-[var(--sd-blue)]" /> Worker
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-[var(--border)]">
              <Laptop className="h-4 w-4 text-[var(--sd-blue)]" /> Desktop
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-[var(--border)]">
              <Smartphone className="h-4 w-4 text-[var(--sd-blue)]" /> Mobile
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-[var(--border)]">
              <HardDrive className="h-4 w-4 text-[var(--sd-green)]" /> Local backend
            </span>
          </div>
        </div>
        <div className="mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 md:mx-auto md:max-w-6xl">
          {pillars.map((p, i) => (
            <motion.article
              key={p.title}
              className="w-[85%] shrink-0 snap-center rounded-2xl border border-[var(--border)] bg-white/95 p-6 shadow-md shadow-blue-500/10 md:w-[300px]"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
            >
              <div className="mb-4 h-1.5 w-14 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B]" />
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

      <section ref={parallaxRef} className="relative overflow-hidden border-t border-[var(--border)] sd-section-mix py-24">
        <motion.div style={{ y }} className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.1]">
          <div className="rounded-xl bg-white p-3">
            <Image
              src="/brand/logo-lockup-horizontal.jpg"
              alt=""
              width={420}
              height={90}
              className="h-20 w-auto object-contain md:h-24"
            />
          </div>
        </motion.div>
        <div className="relative mx-auto max-w-3xl rounded-3xl border border-white/60 bg-white/70 px-8 py-10 text-center shadow-lg shadow-blue-500/10 backdrop-blur-sm">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Not an inventory system.</h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--muted)]">
            No on-hand counts. No reorder alerts. No warehouse bins. StoreDesk is for prices, vendors, invoices, and the
            people standing at the register.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--border)] sd-section-blue px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-green)]">How it works</p>
          <h2 className="mt-2 text-3xl font-bold">From install to daily ops</h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-2">
            {steps.map((s, i) => (
              <motion.li
                key={s.n}
                className="rounded-2xl border border-[var(--border)] bg-white/95 p-6 shadow-md shadow-emerald-500/10"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="inline-flex rounded-full bg-gradient-to-r from-[#1A63F4]/15 to-[#00A87B]/15 px-2.5 py-0.5 font-mono text-sm font-semibold text-[var(--sd-blue)]">
                  {s.n}
                </span>
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

      <section className="border-t border-[var(--border)] px-6 py-20 sd-section-green">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--border)] bg-gradient-to-br from-white via-[#eef4ff] to-[#e8faf3] px-8 py-12 text-center shadow-xl shadow-blue-500/15">
          <Image
            src="/brand/logo-lockup-horizontal.jpg"
            alt="StoreDesk"
            width={200}
            height={42}
            className="mx-auto h-10 w-auto rounded-lg bg-white object-contain p-2"
          />
          <h2 className="mt-6 text-3xl font-bold tracking-tight">Ready to set up a store?</h2>
          <p className="mt-4 text-[var(--muted)]">
            Ask us about Worker install, Desktop, and Mobile for your backoffice PC. Email{" "}
            <a className="font-semibold text-[var(--sd-blue)] underline" href={contactMailto()}>
              {SITE.email}
            </a>
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={contactMailto({ subject: "StoreDesk setup inquiry" })}
              className="rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:brightness-105"
            >
              Open email
            </a>
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
