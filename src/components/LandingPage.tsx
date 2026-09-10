"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { DeviceStage } from "@/components/DeviceStage";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { contactMailto } from "@/lib/site";
import {
  HardDrive,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Zap,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Search,
  DollarSign,
  Tag,
  Receipt
} from "lucide-react";

/** Official Tech Brand SVG Logos */
/** Rotating words for hero focus pill — all grounded in features the app actually has */
const FLIP_WORDS = [
  "Know what you paid before you reprice",
  "See every supplier's price on one item",
  "Spot the items you are losing money on",
  "Scan a shelf tag and get the margin",
  "File your ST-3 without retyping it",
  "Keep trading when the internet drops"
];

/** App screens — grounded in features that exist in StoreDesk Mobile today */
const validatedScreens = [
  {
    id: "sign-in",
    src: "/screenshots/mobile-app-1.jpeg",
    title: "Sign in",
    subtitle: "Staff accounts you set up",
    desc: "Each person signs in with an account you create for them — there is no public sign-up — and you choose which screens they can open.",
    tag: "Sign in",
    icon: Smartphone
  },
  {
    id: "dashboard",
    src: "/screenshots/mobile-app-2.jpeg",
    title: "Dashboard",
    subtitle: "Today’s sales from the register",
    desc: "Net sales split by department, tax or fuel, with the day’s transactions listed underneath as the register records them.",
    tag: "Sales",
    icon: BarChart3
  },
  {
    id: "transaction",
    src: "/screenshots/mobile-app-3.jpeg",
    title: "Transaction detail",
    subtitle: "Every line and every tax",
    desc: "Open any sale to see what was rung up, how it was paid, and how the tax was split — without walking back to the register.",
    tag: "Receipts",
    icon: Receipt
  },
  {
    id: "price-book",
    src: "/screenshots/mobile-app-4.jpeg",
    title: "Price book",
    subtitle: "Search or scan the catalogue",
    desc: "Your whole catalogue on the phone. Search by name or barcode, or tap Scan UPC and point the camera at a shelf tag.",
    tag: "Catalogue",
    icon: Search
  },
  {
    id: "item",
    src: "/screenshots/mobile-app-5.jpeg",
    title: "Item detail",
    subtitle: "Price, barcode, department, tax",
    desc: "The shelf price the register charges, with the barcode, department and tax category it is filed under.",
    tag: "Item",
    icon: Tag
  },
  {
    id: "cost",
    src: "/screenshots/mobile-app-6.jpeg",
    title: "Cost analysis",
    subtitle: "What each supplier charges",
    desc: "Every supplier you buy the item from, cheapest per unit first and marked Best cost — handy when a rep is on the phone.",
    tag: "Suppliers",
    icon: DollarSign
  }
];

const steps = [
  {
    n: "01",
    title: "Install on the back-office PC",
    body: "Run the installer on the Windows PC that can reach your register. Your catalogue and sales history are stored on that machine, not in the cloud."
  },
  {
    n: "02",
    title: "Pull in your price book",
    body: "Point StoreDesk at your Commander and it reads the whole PLU list. Then add what each supplier charges you — per case, pack or unit."
  },
  {
    n: "03",
    title: "Sign in on your phone",
    body: "Install the Android app and sign in with the account you were given. It reaches your store securely from anywhere — it does not need to be on the store Wi-Fi."
  },
  {
    n: "04",
    title: "Walk the floor",
    body: "Scan a shelf tag to see the price, the cheapest supplier and the margin. Catch the items you are selling below cost before the next delivery."
  }
];

/** Linear-style Spotlight Card Component */
/** Interactive Single 3D Phone Circular Carousel Component */
function MobileShowcaseCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % validatedScreens.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const activeScreen = validatedScreens[activeIndex];

  function handlePrev() {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev - 1 + validatedScreens.length) % validatedScreens.length);
  }

  function handleNext() {
    setIsAutoPlaying(false);
    setActiveIndex((prev) => (prev + 1) % validatedScreens.length);
  }

  function handleSelect(index: number) {
    setIsAutoPlaying(false);
    setActiveIndex(index);
  }

  return (
    <div
      className="mx-auto mt-12 grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-2"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* 3D Phone Model Display with Smooth Image Carousel */}
      <div className="relative flex flex-col items-center justify-center">

        <div className="relative z-10 w-[270px] sm:w-[290px] perspective-[1000px]">
          <div className="relative rounded-[3.2rem] border-[9px] border-slate-900 bg-slate-950 p-1.5 shadow-[0_25px_60px_-15px_rgba(11,31,77,0.3)] ring-2 ring-white/20">
            <div className="absolute -left-[13px] top-24 h-10 w-[4px] rounded-l-md bg-slate-800" />
            <div className="absolute -left-[13px] top-38 h-10 w-[4px] rounded-l-md bg-slate-800" />
            <div className="absolute -right-[13px] top-32 h-14 w-[4px] rounded-r-md bg-slate-800" />

            <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950">
              <div className="relative z-20 bg-slate-900/90 px-4 pb-1 pt-2.5 backdrop-blur-md">
                <div className="absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-950 flex items-center justify-end px-2">
                  <div className="h-2 w-2 rounded-full bg-slate-800 ring-1 ring-slate-700" />
                </div>
                <div className="flex items-center justify-between text-[8px] font-bold text-slate-300">
                  <span>9:41</span>
                  <span>StoreDesk · 5G</span>
                </div>
              </div>

              <div className="relative h-[480px] w-full overflow-hidden bg-slate-900">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeScreen.id}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.03 }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={activeScreen.src}
                      alt={activeScreen.title}
                      fill
                      className="object-cover object-top"
                      priority
                    />
                  </motion.div>
                </AnimatePresence>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
              </div>

              <div className="relative z-20 flex justify-center bg-slate-950 py-1.5">
                <div className="h-1 w-24 rounded-full bg-slate-700" />
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Navigation Arrows */}
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handlePrev}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-[#1A63F4] hover:text-[#1A63F4]"
            aria-label="Previous Screen"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex gap-2">
            {validatedScreens.map((_, i) => (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === activeIndex ? "w-8 bg-[#1A63F4]" : "w-2.5 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Go to screen ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-[#1A63F4] hover:text-[#1A63F4]"
            aria-label="Next Screen"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Screen Selector Pills & Active Feature Spotlight */}
      <div className="space-y-4">
        <div className="mb-2">
          <span className="inline-flex rounded-full bg-[#00A87B]/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#00A87B]">
            Screen {activeIndex + 1} of {validatedScreens.length}
          </span>
          <h3 className="mt-2 text-2xl font-extrabold text-[#17202A] sm:text-3xl">
            {activeScreen.title}
          </h3>
          <p className="mt-1 text-[15px] font-semibold text-[#1A63F4]">
            {activeScreen.subtitle}
          </p>
        </div>

        <motion.div
          key={activeScreen.id}
          initial={{ y: 8 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-slate-300 bg-slate-50 p-6 shadow-sm"
        >
          <p className="text-[17px] font-medium leading-relaxed text-slate-800">
            {activeScreen.desc}
          </p>
        </motion.div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {validatedScreens.map((screen, idx) => {
            const Icon = screen.icon;
            const isSelected = idx === activeIndex;
            return (
              <button
                key={screen.id}
                onClick={() => handleSelect(idx)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition duration-200 ${
                  isSelected
                    ? "border-[#1A63F4] bg-[#1A63F4] text-white shadow-md"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-[#17202A]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold">{screen.title}</p>
                  <p
                    className={`truncate text-[12px] ${
                      isSelected ? "text-white/80" : "text-slate-500"
                    }`}
                  >
                    {screen.tag}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const [flipIndex, setFlipIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // A line that rewrites itself every three seconds is hostile to anyone who
    // has asked the OS to reduce motion, so it simply holds on the first line.
    if (reduceMotion) return;
    const timer = setInterval(() => {
      setFlipIndex((prev) => (prev + 1) % FLIP_WORDS.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  return (
    <div className="min-h-screen bg-white text-[#17202A] antialiased selection:bg-[#00A87B] selection:text-white">
      {/* 1. HEADER / GLOBAL NAVIGATION */}
      <SiteHeader />

      {/* Hero — the same grid ground as every other page, not a radial wash */}
      <section className="sd-hero-wash relative overflow-hidden border-b border-[var(--border)] pb-20 pt-12">

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:pb-12">
          {/* Left Column - 50% */}
          <div>
            <motion.p
              className="sd-eyebrow mb-4"
              initial={{ y: reduceMotion ? 0 : 10 }}
              animate={{ y: 0 }}
            >
              For convenience stores and gas stations
            </motion.p>

            {/* Stable Non-Wobbling Headline */}
            <motion.h1
              className="text-balance text-[38px] font-extrabold leading-[1.04] tracking-[-0.04em] text-[#17202A] sm:text-[48px] lg:text-[56px]"
              initial={{ y: reduceMotion ? 0 : 16 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.05 }}
            >
              Take control of your{" "}
              <span className="bg-gradient-to-r from-[#1A63F4] to-[#00A87B] bg-clip-text text-transparent">
                convenience store margins.
              </span>
            </motion.h1>

            <motion.p
              className="sd-lede mt-5 max-w-md"
              initial={{ y: 12 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Runs on your back-office PC. Track every vendor&apos;s cost, compare prices across suppliers, see the margin on every item, and let your staff scan barcodes anywhere on the floor.
            </motion.p>

            {/* Dynamic Focus Feature Pill */}
            <motion.div
              className="mt-4 flex h-8 items-center gap-2 text-sm font-bold text-[#00A87B]"
              transition={{ delay: 0.11 }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00A87B]" />
              <div className="relative h-6 w-72 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={FLIP_WORDS[flipIndex]}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 truncate font-semibold text-slate-900"
                  >
                    {FLIP_WORDS[flipIndex]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Local-first honest value badge */}
            <motion.div
              className="mt-4 inline-flex items-center gap-3 rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 shadow-sm backdrop-blur-sm"
              initial={{ y: 8 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <HardDrive className="h-4 w-4 text-[#00A87B]" />
              <span className="text-[13px] font-bold text-slate-900">
                Your data stays in your store &middot; Keeps working when the internet is down
              </span>
            </motion.div>

            {/* Badges Flex Row */}
            <motion.div
              className="mt-5 flex flex-wrap items-center gap-3"
              initial={{ y: 8 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.13 }}
            >
              <VerifoneBadge />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-900 shadow-sm">
                <HardDrive className="h-3.5 w-3.5 text-[#00A87B]" />
                Windows back-office PC &middot; Android phone app
              </span>
            </motion.div>

            {/* Action Row */}
            <motion.div
              className="mt-8 flex flex-wrap gap-3.5"
              initial={{ y: 12 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-6 py-3.5 text-[15.5px] font-bold text-white shadow-[0_8px_22px_-8px_rgba(26,99,244,0.6)] transition hover:brightness-110"
                >
                  How it works <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                <a
                  href={contactMailto({ subject: "StoreDesk setup inquiry" })}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3.5 text-[15.5px] font-bold text-[#17202A] shadow-sm transition hover:border-[#1A63F4] hover:text-[#1A63F4]"
                >
                  Contact us
                </a>
              </motion.div>
            </motion.div>
          </div>

          {/* Right Column - 50% High-End 3D Device Stage */}
          <div className="flex flex-col items-center justify-center">
            <DeviceStage />
          </div>
        </div>
      </section>

      {/* 3. CORE PURPOSE (Clean Bright Light Background - High Contrast) */}
      <section className="border-y border-slate-200 bg-slate-50 py-24 text-[#17202A]">
        <div className="mx-auto grid max-w-6xl md:grid-cols-[32%_68%]">
          {/* Left Column - 32% Sticky Scrollytelling */}
          <div className="px-6 pb-8 md:pb-0">
            <div className="sticky top-28">
              <div className="mb-3 h-1.5 w-14 rounded-full bg-[#00A87B]" />
              <h2 className="text-3xl font-extrabold tracking-tight text-[#17202A] md:text-[40px]">What it is for</h2>
              <p className="mt-3 text-[16px] font-medium leading-relaxed text-slate-700">
                Three things the register cannot tell you on its own.
              </p>
            </div>
          </div>

          {/* Right Column - 68% High-Contrast White Cards */}
          <div className="space-y-8 px-6 md:border-l md:border-slate-200 md:pl-10">
            <motion.article
              initial={{ y: 16 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition duration-300 hover:border-[#1A63F4] hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00A87B] text-white font-bold shadow-sm">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-bold text-[#17202A] sm:text-[22px]">See your margin before you reprice</h3>
              </div>
              <p className="mt-4 text-base font-normal leading-relaxed text-slate-700">
                The register knows what each item sells for. Your invoices know what it cost. StoreDesk puts those two numbers side by side, per unit, so you can see the margin before you change a shelf tag.
              </p>
            </motion.article>

            <motion.article
              initial={{ y: 16 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition duration-300 hover:border-[#1A63F4] hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1A63F4] text-white font-bold shadow-sm">
                  <Zap className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-bold text-[#17202A] sm:text-[22px]">It only reads from the register</h3>
              </div>
              <p className="mt-4 text-base font-normal leading-relaxed text-slate-700">
                StoreDesk reads prices and sales from your Verifone Commander and never writes back. Nothing it does can change a price at the till or slow a lane during a rush — if StoreDesk stopped tomorrow, the store would keep trading.
              </p>
            </motion.article>

            <motion.article
              initial={{ y: 16 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition duration-300 hover:border-[#1A63F4] hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00A87B] text-white font-bold shadow-sm">
                  <BarChart3 className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-bold text-[#17202A] sm:text-[22px]">Answers on the shop floor</h3>
              </div>
              <p className="mt-4 text-base font-normal leading-relaxed text-slate-700">
                Scan a shelf tag anywhere in the store to see the shelf price, what you paid and which supplier is cheapest.
              </p>
            </motion.article>
          </div>
        </div>
      </section>

      {/* 4. APPLICATION INTERFACE (Single 3D Phone Showcase Carousel) */}
      <section className="bg-white py-24 overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#17202A] md:text-[40px]">
            The phone app, screen by screen
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[17px] font-medium text-slate-700">
            Real screens from the Android app, running against a demo store.
          </p>
        </div>

        {/* Single 3D Phone Circular Showcase Carousel */}
        <MobileShowcaseCarousel />
      </section>

      {/* 6. HOW IT WORKS (Background: White to Light Gradient) */}
      <section className="border-t border-[var(--border)] bg-[#FBFCFD] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div>
            <span className="inline-flex rounded-full bg-[#00A87B]/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#00A87B]">
              HOW IT WORKS
            </span>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#17202A] md:text-[40px]">
              From setup to daily operations
            </h2>
          </div>

          {/* 2x2 Grid of Step Cards */}
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                className="group rounded-2xl border border-slate-300 bg-white p-6 shadow-sm transition hover:border-[#1A63F4] hover:shadow-md"
                initial={{ y: 16 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="inline-flex rounded-full bg-[#1A63F4]/10 px-3 py-1 font-mono text-xs font-bold text-[#1A63F4]">
                  Step {s.n}
                </span>
                <h3 className="mt-3 text-xl font-bold text-[#17202A]">{s.title}</h3>
                <p className="mt-2 text-[16px] font-medium leading-relaxed text-slate-700">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
