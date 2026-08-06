"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { DeviceStage } from "@/components/DeviceStage";
import { SiteHeader } from "@/components/SiteChrome";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { SITE, contactMailto } from "@/lib/site";
import {
  Database,
  Globe,
  HardDrive,
  Laptop,
  Server,
  Sparkles
} from "lucide-react";

/** 6 Validated App Screens mapped from project wireframes */
const validatedScreens = [
  {
    src: "/screenshots/mobile-app-1.jpeg",
    title: "StoreDesk Login",
    desc: "Authentication screen for the desktop & mobile app"
  },
  {
    src: "/screenshots/mobile-app-5.jpeg",
    title: "Sales Tax & Analytics",
    desc: "Dashboard featuring sales breakdowns & live transaction feed"
  },
  {
    src: "/screenshots/mobile-app-6.jpeg",
    title: "Transaction & Register Sync",
    desc: "Detailed view of specific transaction line items & subtotal"
  },
  {
    src: "/screenshots/mobile-app-2.jpeg",
    title: "Barcode Scanner & Search",
    desc: "Price Book catalog with search bar & UPC scan trigger"
  },
  {
    src: "/screenshots/mobile-app-3.jpeg",
    title: "Product Details & Price Comparison",
    desc: "Live PLU details showing selling price, dept & tax categories"
  },
  {
    src: "/screenshots/mobile-app-4.jpeg",
    title: "Vendor Prices & Cost Breakdown",
    desc: "Cost analysis overlay comparing retail vs local vendor costs"
  }
];

const techStack = [
  {
    name: "Electron & React",
    role: "Desktop Command Center",
    desc: "Primary command center UI for store managers connecting to local Edge Agent or Cloud Hub.",
    icon: Laptop,
    badge: "Desktop App"
  },
  {
    name: "Node.js & Express",
    role: "Local Edge Agent",
    desc: "Acts as outbound Edge Agent on local Store PC reading directly from Verifone Commander.",
    icon: Server,
    badge: "Edge Agent"
  },
  {
    name: "GCP Cloud Run & WebSockets",
    role: "Real-Time Cloud Hub",
    desc: "Central WebSocket hub maintaining dynamic event-driven rooms keyed by store_id.",
    icon: Globe,
    badge: "Cloud Hub"
  },
  {
    name: "Next.js & MongoDB",
    role: "Web Portal & Admin",
    desc: "Vercel-hosted marketing portal and internal company admin for licenses & telemetry.",
    icon: Database,
    badge: "Web Portal"
  }
];

const steps = [
  {
    n: "01",
    title: "Install Store Engine",
    body: "Local PC setup running Edge Agent on store back-office PC."
  },
  {
    n: "02",
    title: "Sign In & Provision Accounts",
    body: "Secure org access provisioned when store license is created."
  },
  {
    n: "03",
    title: "Connect Floor Devices",
    body: "Scan barcodes anywhere on the floor over store Wi-Fi."
  },
  {
    n: "04",
    title: "Compare & Set Prices",
    body: "Protect profit margins with live wholesale vendor cost overlays."
  }
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0B1F4D] antialiased">
      {/* 1. HEADER / GLOBAL NAVIGATION */}
      <SiteHeader />

      {/* 2. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F0F8FF] via-[#F8FAFC] to-white pb-20 pt-10">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:pb-12">
          {/* Left Column - 50% */}
          <div>
            <motion.p
              className="mb-3 inline-flex rounded-full bg-[#00B36B]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#00B36B]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              CONVENIENCE · GAS · C-STORE MANAGEMENT
            </motion.p>
            <motion.h1
              className="text-4xl font-extrabold tracking-tight text-[#0B1F4D] sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              Built for store operators — not warehouse inventory.
            </motion.h1>
            <motion.p
              className="mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Manage vendor pricing, compare wholesale costs, calculate shelf prices, and inspect register transactions in real-time from your back-office computer and store devices.
            </motion.p>

            {/* Badges Flex Row */}
            <motion.div
              className="mt-6 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <VerifoneBadge />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                <HardDrive className="h-3.5 w-3.5 text-[#00B36B]" />
                Back-office PC - Real-time Relay
              </span>
            </motion.div>

            {/* Action Row */}
            <motion.div
              className="mt-8 flex flex-wrap gap-3.5"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Link
                href="/how-it-works"
                className="rounded-xl bg-[#1D4ED8] px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg"
              >
                How it works
              </Link>
              <a
                href={contactMailto({ subject: "StoreDesk setup inquiry" })}
                className="rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-[#0B1F4D] shadow-sm transition hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
              >
                Contact us
              </a>
            </motion.div>
          </div>

          {/* Right Column - 50% */}
          <div className="flex flex-col items-center justify-center">
            <DeviceStage />
          </div>
        </div>

        {/* Hero Banner Component */}
        <div className="mx-auto mt-6 max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-2xl">
            <Image
              src="/screenshots/store-banner.png"
              alt="StoreDesk Store Operations Banner"
              width={1200}
              height={400}
              className="h-auto w-full rounded-xl object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* 3. CORE PURPOSE (Solid Navy #0B1F4D) */}
      <section className="bg-[#0B1F4D] py-24 text-white">
        <div className="mx-auto grid max-w-6xl md:grid-cols-[30%_70%]">
          {/* Left Column - 30% Sticky */}
          <div className="px-6 pb-8 md:pb-0">
            <div className="sticky top-24">
              <div className="mb-2 h-1.5 w-12 rounded-full bg-[#00B36B]" />
              <h2 className="text-3xl font-extrabold tracking-tight text-white">Why StoreDesk exists</h2>
              <p className="mt-3 text-sm text-slate-300">
                Read-only Price Book reference and margin overlays built specifically for convenience stores and gas stations.
              </p>
            </div>
          </div>

          {/* Right Column - 70% Scrolling list */}
          <div className="space-y-12 px-6 md:border-l md:border-white/15 md:pl-12">
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <h3 className="text-2xl font-bold text-white">Protect profit margins against rising costs</h3>
              <p className="mt-3 text-base leading-relaxed text-slate-300">
                Retail prices live on your cash register while wholesale costs live in vendor invoices. StoreDesk connects those two worlds so true per-unit profit margins are transparent before changing shelf labels.
              </p>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <h3 className="text-2xl font-bold text-white">Read-only POS register integration</h3>
              <p className="mt-3 text-base leading-relaxed text-slate-300">
                Integrates safely with Verifone Commander via read-only register streams (<code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-[#00B36B]">vPLUs</code>, <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-[#00B36B]">vrubyrept</code>, <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-[#00B36B]">vtransset</code>). Zero risk to register configurations or cash register performance.
              </p>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <h3 className="text-2xl font-bold text-white">Fast floor access & scan lookup</h3>
              <p className="mt-3 text-base leading-relaxed text-slate-300">
                Scan barcodes anywhere in the store to instantly inspect wholesale cost per item, department tax breakdown, best supplier cost, and suggested retail price.
              </p>
            </motion.article>
          </div>
        </div>
      </section>

      {/* 4. APPLICATION INTERFACE (Background: White) */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1F4D] md:text-4xl">
            Designed for speed at the counter & on the floor
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
            Explore the key validated screens of StoreDesk — built for rapid price checks, register sync, and margin analysis.
          </p>
        </div>

        {/* 6 Screen Cards Grid */}
        <div className="mx-auto mt-12 grid max-w-6xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {validatedScreens.map((screen, idx) => (
            <motion.div
              key={screen.title}
              className="group rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-1 hover:border-[#1D4ED8] hover:shadow-md"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="relative overflow-hidden rounded-xl bg-slate-900">
                <Image
                  src={screen.src}
                  alt={screen.title}
                  width={440}
                  height={900}
                  className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <h3 className="text-base font-bold text-[#0B1F4D]">{screen.title}</h3>
                <p className="mt-1 text-xs text-slate-600">{screen.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 5. ARCHITECTURE OVERVIEW (Background: Light Ice-Blue #F0F8FF) */}
      <section className="bg-[#F0F8FF] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <span className="inline-flex rounded-full bg-[#00B36B]/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#00B36B]">
              SYSTEM TOPOGRAPHY
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0B1F4D] md:text-4xl">
              Modern Event-Driven Technology Stack
            </h2>
          </div>

          {/* 4-Column Grid - White Cards, Navy borders, Emerald Icons */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {techStack.map((tech) => {
              const Icon = tech.icon;
              return (
                <div
                  key={tech.name}
                  className="rounded-xl border border-[#0B1F4D]/20 bg-white p-6 shadow-sm transition hover:border-[#1D4ED8] hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex rounded-xl bg-[#00B36B] p-2.5 text-white shadow-sm">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-[#0B1F4D]">
                      {tech.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[#0B1F4D]">{tech.name}</h3>
                  <p className="text-xs font-semibold text-[#1D4ED8]">{tech.role}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{tech.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Full Width Callout Box - Warning/Scope Notice Style */}
          <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-amber-200 bg-amber-50/90 p-8 text-center shadow-sm">
            <h3 className="text-2xl font-extrabold text-amber-950">Not an inventory system.</h3>
            <p className="mt-3 text-sm leading-relaxed text-amber-900/80">
              No stock quantity limits. No inventory count tracking. No warehouse locations. StoreDesk is built exclusively for price book management, vendor cost overlays, and margin transparency.
            </p>
          </div>
        </div>
      </section>

      {/* 6. HOW IT WORKS (Background: White to Light Gradient) */}
      <section className="bg-gradient-to-b from-white to-[#F8FAFC] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div>
            <span className="inline-flex rounded-full bg-[#00B36B]/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#00B36B]">
              HOW IT WORKS
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0B1F4D] md:text-4xl">
              From setup to daily operations
            </h2>
          </div>

          {/* 2x2 Grid of Step Cards */}
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="inline-flex rounded-full bg-[#1D4ED8]/10 px-3 py-1 font-mono text-xs font-bold text-[#1D4ED8]">
                  Step {s.n}
                </span>
                <h3 className="mt-3 text-xl font-bold text-[#0B1F4D]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FOOTER & FLOATING CTA */}
      <div className="relative bg-[#0B1F4D] pt-16">
        {/* Floating CTA Card overlapping top edge of Footer */}
        <div className="relative mx-auto max-w-4xl px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-2xl md:p-12">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00B36B] text-white">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-3xl font-extrabold tracking-tight text-[#0B1F4D]">Ready to set up your store?</h3>
            <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
              Get in touch to bring StoreDesk to your back-office computer and store devices.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3.5">
              <a
                href={contactMailto({ subject: "StoreDesk Setup Inquiry" })}
                className="rounded-xl bg-[#1D4ED8] px-7 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700"
              >
                Open email
              </a>
              <Link
                href="/how-it-works"
                className="rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-sm font-bold text-[#0B1F4D] shadow-sm transition hover:border-[#1D4ED8]"
              >
                How it works
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Base - Deep Navy to Vivid Blue Gradient */}
        <footer className="mt-16 border-t border-white/10 bg-gradient-to-r from-[#0B1F4D] via-[#0E2866] to-[#1D4ED8] px-6 pb-12 pt-20 text-white">
          <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.5fr_1fr_1fr]">
            {/* Left */}
            <div>
              <Image
                src="/brand/logo-lockup-horizontal.jpg"
                alt="StoreDesk"
                width={180}
                height={40}
                className="mb-4 h-9 w-auto rounded bg-white p-1 object-contain"
              />
              <p className="max-w-sm text-xs leading-relaxed text-slate-300">
                Read-only price book management, wholesale vendor cost overlays, and register margin analysis for convenience stores and gas stations.
              </p>
              <p className="mt-6 text-xs text-slate-400">
                © 2026 StoreDesk. Built for convenience stores & gas stations.
              </p>
            </div>

            {/* Center */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#00B36B]">Explore</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-300">
                <li>
                  <Link href="/" className="hover:text-white">Home</Link>
                </li>
                <li>
                  <Link href="/product" className="hover:text-white">Product</Link>
                </li>
                <li>
                  <Link href="/how-it-works" className="hover:text-white">How it works</Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-white">About</Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-white">Contact</Link>
                </li>
              </ul>
            </div>

            {/* Right */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#00B36B]">Contact</h4>
              <a
                href={contactMailto()}
                className="mt-4 block text-sm font-semibold text-white underline decoration-white/30 hover:decoration-white"
              >
                {SITE.email}
              </a>
              <div className="mt-6 flex gap-4 text-xs text-slate-300">
                <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-white">Terms of Service</Link>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
