"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { DeviceStage } from "@/components/DeviceStage";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 }
};

export function LandingHero() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050608] text-white">
      {/* atmosphere */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 top-0 h-[60vh] w-[70vw] rounded-full bg-[radial-gradient(circle,rgba(14,67,216,0.45),transparent_70%)] blur-3xl" />
        <div className="absolute -right-1/4 bottom-0 h-[50vh] w-[60vw] rounded-full bg-[radial-gradient(circle,rgba(0,168,123,0.35),transparent_70%)] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)"
          }}
        />
      </div>

      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
          <Image
            src="/brand/logo-lockup-horizontal.svg"
            alt="StoreDesk"
            width={168}
            height={36}
            priority
            className="brightness-110"
          />
        </motion.div>
        <nav className="flex items-center gap-5 text-sm font-semibold text-white/70">
          <Link href="#product" className="transition hover:text-white">
            Product
          </Link>
          <Link
            href="/admin"
            className="rounded-full bg-white px-4 py-2 text-[#0E43D8] transition hover:bg-white/90"
          >
            License admin
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-8 lg:grid-cols-2 lg:pt-4">
        <div>
          <motion.p
            className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[var(--sd-mint)]"
            {...fadeUp}
            transition={{ duration: 0.5 }}
          >
            Edge catalog · Cloud licenses
          </motion.p>
          <motion.h1
            className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--font-display), var(--font-geist-sans), system-ui, sans-serif" }}
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.05 }}
          >
            <span className="bg-gradient-to-r from-white via-white to-[var(--sd-mint)] bg-clip-text text-transparent">
              StoreDesk
            </span>
            <span className="mt-2 block text-white/90">command center for the counter</span>
          </motion.h1>
          <motion.p
            className="mt-5 max-w-md text-base leading-relaxed text-white/60 sm:text-lg"
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.12 }}
          >
            Desktop Price Book and POS on the store PC. StoreDesk Mobile on the floor. License every location from
            the cloud — catalog stays at the edge.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-wrap gap-3"
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.18 }}
          >
            <Link
              href="/admin"
              className="rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-6 py-3 text-sm font-bold shadow-[0_0_32px_rgba(26,99,244,0.45)] transition hover:brightness-110"
            >
              Manage store licenses
            </Link>
            <a
              href="https://github.com/storedesk-dev"
              className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold backdrop-blur transition hover:border-white/40 hover:bg-white/10"
            >
              GitHub
            </a>
          </motion.div>
        </div>

        <DeviceStage />
      </section>

      <section id="product" className="relative z-10 border-t border-white/10 bg-black/40 px-6 py-20 backdrop-blur-sm">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {[
            {
              title: "Edge catalog",
              body: "Products, invoices, and Verifone Commander live on the store computer — not dumped into a shared cloud DB."
            },
            {
              title: "StoreDesk Mobile",
              body: "Scan barcodes, see best vendor cost and suggested sell price. LAN today; cloud hub relay next."
            },
            {
              title: "License control",
              body: "Atlas-backed STORE_ID and AGENT_KEY per store. Rotate or suspend without touching catalog data."
            }
          ].map((card, i) => (
            <motion.article
              key={card.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
            >
              <div className="mb-3 h-1 w-10 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B]" />
              <h2 className="text-lg font-bold text-white">{card.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{card.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-6 py-8 text-center text-xs text-white/35">
        StoreDesk · Desktop · Mobile · Web licenses
      </footer>
    </div>
  );
}
