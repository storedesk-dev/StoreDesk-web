"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { DeviceStage } from "@/components/DeviceStage";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { SITE, contactMailto } from "@/lib/site";
import {
  Database,
  Globe,
  HardDrive,
  Laptop,
  Server
} from "lucide-react";

const pillars = [
  {
    title: "Edge Engine",
    body: "Runs locally on your store PC to process store catalog data, vendor costs, and POS register feeds instantly."
  },
  {
    title: "StoreDesk Desktop",
    body: "Primary Electron command center for managers to review price books, analyze margins, and compare supplier costs."
  },
  {
    title: "StoreDesk Mobile",
    body: "Floor companion app for scanning UPC barcodes, checking supplier costs, and viewing real-time register receipts."
  },
  {
    title: "Local & Private",
    body: "Store records stay securely on your back-office computer. Operates reliably even during internet outages."
  }
];

const steps = [
  {
    n: "01",
    title: "Install Store Engine",
    body: "Set up StoreDesk locally on your store back-office PC in minutes."
  },
  {
    n: "02",
    title: "Sign In & Provision Accounts",
    body: "Log in with secure organization accounts provisioned for your store."
  },
  {
    n: "03",
    title: "Connect Floor Devices",
    body: "Scan barcodes anywhere on the floor over store Wi-Fi."
  },
  {
    n: "04",
    title: "Compare & Set Prices",
    body: "Instantly compare supplier costs against retail prices to protect profit margins."
  }
];

/** 6 Validated App Screens mapped from project designs */
const validatedScreens = [
  {
    src: "/screenshots/mobile-app-1.jpeg",
    title: "StoreDesk Login",
    desc: "Secure authentication for store staff and managers"
  },
  {
    src: "/screenshots/mobile-app-5.jpeg",
    title: "Sales Tax & Analytics",
    desc: "Dashboard with live category sales & tax breakdowns"
  },
  {
    src: "/screenshots/mobile-app-6.jpeg",
    title: "Transaction & Register Sync",
    desc: "Detailed receipt view with line items & subtotal"
  },
  {
    src: "/screenshots/mobile-app-2.jpeg",
    title: "Barcode Scanner & Search",
    desc: "Price Book catalog with search & UPC scan trigger"
  },
  {
    src: "/screenshots/mobile-app-3.jpeg",
    title: "Product Details & Price Comparison",
    desc: "Live PLU details, margin overlays & retail price"
  },
  {
    src: "/screenshots/mobile-app-4.jpeg",
    title: "Vendor Prices & Cost Breakdown",
    desc: "Cost comparison comparing retail vs supplier cost"
  }
];

const techStack = [
  {
    name: "Electron & React",
    role: "Desktop Command Center",
    desc: "Cross-platform desktop application built for high-speed store management.",
    icon: Laptop,
    badge: "Desktop App"
  },
  {
    name: "Node.js & Express",
    role: "Local Edge Agent",
    desc: "High-performance store PC service reading directly from Verifone Commander.",
    icon: Server,
    badge: "Edge Agent"
  },
  {
    name: "GCP Cloud Run & WebSockets",
    role: "Real-Time Cloud Hub",
    desc: "Event-driven WebSocket relay server maintaining dynamic store telemetry rooms.",
    icon: Globe,
    badge: "Cloud Hub"
  },
  {
    name: "Next.js & MongoDB",
    role: "Web Portal & Admin",
    desc: "Vercel-hosted control plane for license generation and security management.",
    icon: Database,
    badge: "Web Portal"
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

        <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-10 lg:grid-cols-2 lg:pb-20">
          <div>
            <motion.p
              className="mb-3 inline-flex rounded-full bg-gradient-to-r from-[#1A63F4]/15 to-[#00A87B]/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-blue)]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Convenience · Gas · C-Store Management
            </motion.p>
            <motion.h1
              className="text-4xl font-bold tracking-tight text-[var(--foreground)] sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              Built for store operators — not warehouse inventory
            </motion.h1>
            <motion.p
              className="mt-5 max-w-md text-lg leading-relaxed text-[var(--muted)]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Manage vendor pricing, compare wholesale costs, calculate shelf prices, and inspect register transactions in real-time from your back-office computer and store devices.
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
                Back-office PC · Real-time Relay
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

      {/* Prominent Hero Banner */}
      <section className="border-y border-[var(--border)] bg-slate-900 py-6">
        <div className="mx-auto max-w-6xl px-6">
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

      {/* Verifone Commander Hardware Spotlight */}
      <section className="border-b border-[var(--border)] bg-gradient-to-r from-slate-900 via-[#0B1F3A] to-slate-900 py-14 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 md:grid-cols-[220px_1fr]">
          <div className="flex justify-center">
            <div className="relative h-28 w-44 overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
              <Image
                src="/Verifone image.png"
                alt="Verifone Commander POS System"
                width={200}
                height={120}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
          <div>
            <span className="inline-flex rounded-full bg-[#1A63F4]/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#4f8cff]">
              Hardware Compatible
            </span>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">Seamless Verifone® Commander Integration</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Read-only register integration continuously syncs PLU items, transaction receipts, and daily sales reports. Zero risk to register configuration or cash register performance.
            </p>
          </div>
        </div>
      </section>

      <section className="relative border-t border-[var(--border)] sd-section-blue">
        <div className="mx-auto grid max-w-6xl md:grid-cols-[280px_1fr]">
          <div className="hidden md:block">
            <div className="sticky top-24 px-6 py-24">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-green)]">Core Purpose</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Why StoreDesk exists</h2>
            </div>
          </div>
          <div className="space-y-16 px-6 py-16 md:border-l md:border-[var(--border)] md:px-12 md:py-20">
            {[
              {
                t: "Protect profit margins against rising costs",
                b: "Retail prices live on your cash register while wholesale costs live in vendor invoices. StoreDesk connects those two worlds so true per-unit profit margins are transparent."
              },
              {
                t: "Read-only POS register integration",
                b: "Integrates safely with Verifone Commander via read-only register streams (vPLUs, vrubyrept, vtransset). Zero risk to register configurations."
              },
              {
                t: "Fast floor access & scan lookup",
                b: "Scan barcodes anywhere in the store to instantly inspect wholesale cost per item, department tax breakdown, and suggested retail price."
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

      {/* Screen Mockups Gallery */}
      <section className="border-t border-[var(--border)] bg-gradient-to-b from-white via-slate-50 to-[#eef4ff] py-20">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-green)]">Application Interface</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Designed for speed at the counter & on the floor</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            Explore the key screens of StoreDesk — from secure sign-in to sales analytics, register sync, barcode search, and vendor price comparison.
          </p>
        </div>
        <div className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-6 lg:grid lg:grid-cols-3 lg:gap-8 lg:overflow-visible">
          {validatedScreens.map((screen, idx) => (
            <motion.div
              key={screen.title}
              className="group relative shrink-0 snap-center rounded-2xl border border-[var(--border)] bg-white p-3 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl lg:w-auto"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.06 }}
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
                <h3 className="text-base font-bold text-[var(--foreground)]">{screen.title}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{screen.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Product Stack & Tech Architecture */}
      <section className="border-t border-[var(--border)] bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex rounded-full bg-[#1A63F4]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[var(--sd-blue)]">
              System Topography
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Modern Event-Driven Technology Stack</h2>
            <p className="mt-3 max-w-2xl text-sm text-[var(--muted)]">
              StoreDesk combines local store edge reliability with GCP Cloud Run WebSocket relaying for secure, real-time store monitoring.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {techStack.map((tech) => {
              const Icon = tech.icon;
              return (
                <div
                  key={tech.name}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition hover:border-[var(--sd-blue)] hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex rounded-xl bg-gradient-to-br from-[#1A63F4] to-[#00A87B] p-2.5 text-white shadow-sm">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-bold text-[var(--sd-blue)] ring-1 ring-[var(--border)]">
                      {tech.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[var(--foreground)]">{tech.name}</h3>
                  <p className="text-xs font-semibold text-[var(--sd-blue)]">{tech.role}</p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{tech.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] sd-section-green py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-green)]">Architecture Overview</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Four interconnected modules. One store system.</h2>
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
      </section>

      <section ref={parallaxRef} className="relative overflow-hidden border-t border-[var(--border)] sd-section-mix py-24">
        <motion.div style={{ y }} className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.1]">
          <Image
            src="/brand/logo-lockup-horizontal.jpg"
            alt=""
            width={420}
            height={90}
            className="h-20 w-auto object-contain md:h-24"
          />
        </motion.div>
        <div className="relative mx-auto max-w-3xl rounded-3xl border border-white/60 bg-white/70 px-8 py-10 text-center shadow-lg shadow-blue-500/10 backdrop-blur-sm">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Not an inventory system.</h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--muted)]">
            No stock quantity limits. No inventory count tracking. No warehouse locations. StoreDesk is built exclusively for price book management, vendor cost overlays, and margin transparency.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--border)] sd-section-blue px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sd-green)]">How it works</p>
          <h2 className="mt-2 text-3xl font-bold">From setup to daily operations</h2>
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
        </div>
      </section>

      <section className="border-t border-[var(--border)] px-6 py-20 sd-section-green">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--border)] bg-gradient-to-br from-white via-[#eef4ff] to-[#e8faf3] px-8 py-12 text-center shadow-xl shadow-blue-500/15">
          <Image
            src="/brand/logo-lockup-horizontal.jpg"
            alt="StoreDesk"
            width={200}
            height={42}
            className="mx-auto h-10 w-auto object-contain"
          />
          <h2 className="mt-6 text-3xl font-bold tracking-tight">Ready to set up your store?</h2>
          <p className="mt-4 text-[var(--muted)]">
            Get in touch to bring StoreDesk to your store back-office computer and devices. Email{" "}
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
