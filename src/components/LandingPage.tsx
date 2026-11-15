"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { DeviceStage } from "@/components/DeviceStage";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { GooglePlayIcon, WindowsIcon } from "@/components/BrandIcons";
import { DOCS, contactMailto } from "@/lib/site";
import {
  HardDrive,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Zap,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Pause,
  Play,
  Server,
  Smartphone,
  Search,
  DollarSign,
  Tag,
  Receipt,
  Ticket
} from "lucide-react";

/**
 * Three short proof points under the hero copy.
 *
 * This used to be a line that rewrote itself every 3.2 seconds, forever, in a fixed 288px box. That
 * pushed the page sideways at 320px and was auto-updating content with no pause (WCAG 2.2.2), so the
 * three strongest lines now simply sit there.
 */
const PROOF_POINTS = [
  "See every supplier's price on one item",
  "Scan a shelf tag and get the margin",
  "Keep trading when the internet drops"
];

/** The four parts of StoreDesk, as the way into /product. */
const APPS = [
  {
    href: "/product#desktop",
    name: "StoreDesk Desktop",
    line: "The back office on your Windows PC.",
    icon: Monitor
  },
  {
    href: "/product#mobile",
    name: "StoreDesk Mobile",
    line: "Prices, sales and scanning on an Android phone.",
    icon: Smartphone
  },
  {
    href: "/product#service",
    name: "StoreDesk Service",
    line: "Runs on the store PC and talks to the register.",
    icon: Server
  },
  {
    href: "/product/lottery",
    name: "StoreDesk Lottery",
    line: "The instant-ticket rack and the shift close.",
    icon: Ticket
  }
];

/** App screens — grounded in features that exist in StoreDesk Mobile today */
const validatedScreens = [
  {
    id: "sign-in",
    src: "/screenshots/mobile-app-1.jpeg",
    title: "Sign in",
    subtitle: "Staff accounts you set up",
    desc: "Each person signs in with an account you create for them. There is no public sign-up, and you choose which screens they can open.",
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
    desc: "Open any sale to see what was rung up, how it was paid, and how the tax was split, without walking back to the register.",
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
    desc: "Every supplier you buy the item from, cheapest per unit first and marked Best cost. Handy when a rep is on the phone.",
    tag: "Suppliers",
    icon: DollarSign
  }
];

/**
 * StoreDesk Mobile, one screen at a time.
 *
 * It advances on its own only while nobody is looking at it: it stops on hover, on keyboard focus,
 * on any choice, under "reduce motion", and with the Pause button (WCAG 2.2.2 — moving content that
 * starts by itself and runs longer than five seconds needs a way to stop it).
 */
function MobileShowcaseCarousel() {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const advancing = playing && !hovered && !focused && !reduceMotion;

  useEffect(() => {
    if (!advancing) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % validatedScreens.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [advancing]);

  const activeScreen = validatedScreens[activeIndex];

  function handlePrev() {
    setPlaying(false);
    setActiveIndex((prev) => (prev - 1 + validatedScreens.length) % validatedScreens.length);
  }

  function handleNext() {
    setPlaying(false);
    setActiveIndex((prev) => (prev + 1) % validatedScreens.length);
  }

  function handleSelect(index: number) {
    setPlaying(false);
    setActiveIndex(index);
  }

  return (
    <div
      className="mx-auto mt-12 grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-2"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {/* Phone frame with the current screenshot */}
      <div className="relative flex flex-col items-center justify-center">
        <div className="relative z-10 w-[min(270px,100%)] sm:w-[290px]">
          <div className="relative rounded-[3.2rem] border-[9px] border-slate-900 bg-slate-950 p-1.5 shadow-[0_25px_60px_-15px_rgba(11,31,77,0.3)] ring-2 ring-white/20">
            <div className="absolute -left-[13px] top-24 h-10 w-[4px] rounded-l-md bg-slate-800" />
            <div className="absolute -left-[13px] top-38 h-10 w-[4px] rounded-l-md bg-slate-800" />
            <div className="absolute -right-[13px] top-32 h-14 w-[4px] rounded-r-md bg-slate-800" />

            <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950">
              <div className="relative z-20 bg-slate-900/90 px-4 pb-1 pt-2.5 backdrop-blur-md" aria-hidden="true">
                <div className="absolute left-1/2 top-2 flex h-4 w-20 -translate-x-1/2 items-center justify-end rounded-full bg-slate-950 px-2">
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
                      alt={`StoreDesk Mobile, ${activeScreen.title} screen: ${activeScreen.subtitle.toLowerCase()}`}
                      fill
                      sizes="290px"
                      className="object-cover object-top"
                      priority={activeIndex === 0}
                    />
                  </motion.div>
                </AnimatePresence>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
              </div>

              <div className="relative z-20 flex justify-center bg-slate-950 py-1.5" aria-hidden="true">
                <div className="h-1 w-24 rounded-full bg-slate-700" />
              </div>
            </div>
          </div>
        </div>

        {/* Carousel controls: previous, a 24px target per screen, next, and pause. */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handlePrev}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:border-[#1A63F4] hover:text-[#1A63F4]"
            aria-label="Previous screen"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>

          <div className="flex">
            {validatedScreens.map((screen, i) => (
              <button
                key={screen.id}
                type="button"
                onClick={() => handleSelect(i)}
                aria-label={`Show screen ${i + 1}: ${screen.title}`}
                aria-current={i === activeIndex ? "true" : undefined}
                className="group flex h-6 min-w-6 items-center justify-center px-0.5"
              >
                <span
                  className={`block h-2.5 rounded-full transition-[width,background-color] duration-300 ${
                    i === activeIndex ? "w-8 bg-[#1A63F4]" : "w-2.5 bg-slate-400 group-hover:bg-slate-500"
                  }`}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:border-[#1A63F4] hover:text-[#1A63F4]"
            aria-label="Next screen"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>

          {reduceMotion ? null : (
            <button
              type="button"
              onClick={() => setPlaying((value) => !value)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:border-[#1A63F4] hover:text-[#1A63F4]"
              aria-label={playing ? "Pause the screens" : "Play the screens"}
            >
              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            </button>
          )}
        </div>
      </div>

      {/* Screen picker and the active screen's description */}
      <div className="space-y-4">
        {/* Announced only when a person changes the screen, never on every automatic advance. */}
        <div className="mb-2" aria-live={advancing ? "off" : "polite"}>
          <span className="sd-num inline-flex rounded-full bg-[#00A87B]/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#006B4B]">
            Screen {activeIndex + 1} of {validatedScreens.length}
          </span>
          <h3 className="mt-2 text-2xl font-extrabold text-[#17202A] sm:text-3xl">{activeScreen.title}</h3>
          <p className="mt-1 text-[15px] font-semibold text-[#1A63F4]">{activeScreen.subtitle}</p>
        </div>

        <motion.div
          key={activeScreen.id}
          initial={{ y: 8 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-slate-300 bg-slate-50 p-6 shadow-sm"
        >
          <p className="text-[17px] font-medium leading-relaxed text-slate-800">{activeScreen.desc}</p>
        </motion.div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {validatedScreens.map((screen, idx) => {
            const Icon = screen.icon;
            const isSelected = idx === activeIndex;
            return (
              <button
                key={screen.id}
                type="button"
                onClick={() => handleSelect(idx)}
                aria-pressed={isSelected}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors duration-200 ${
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
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{screen.title}</span>
                  <span className={`block truncate text-[12px] ${isSelected ? "text-white/85" : "text-slate-600"}`}>
                    {screen.tag}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  const reduceMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white text-[#17202A] antialiased selection:bg-[#00A87B] selection:text-white">
        <SiteHeader />

        <main id="main" tabIndex={-1} className="outline-none">
          {/* Hero — the same grid ground as every other page, not a radial wash */}
          <section className="sd-hero-wash relative overflow-hidden border-b border-[var(--border)] pb-20 pt-12">
            <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:pb-12">
              <div className="min-w-0">
                <motion.p className="sd-eyebrow mb-4" initial={{ y: reduceMotion ? 0 : 10 }} animate={{ y: 0 }}>
                  For convenience stores and gas stations
                </motion.p>

                <motion.h1
                  className="text-balance text-[34px] font-extrabold leading-[1.04] tracking-[-0.04em] text-[#17202A] sm:text-[48px] lg:text-[56px]"
                  initial={{ y: reduceMotion ? 0 : 16 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  Take control of your{" "}
                  <span className="bg-gradient-to-r from-[#1A63F4] to-[#00875F] bg-clip-text text-transparent">
                    convenience store margins.
                  </span>
                </motion.h1>

                <motion.p
                  className="sd-lede mt-5 max-w-md"
                  initial={{ y: reduceMotion ? 0 : 12 }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  Runs on your back-office PC. See what every supplier charges, the margin on every item and
                  your fuel prices. Staff scan barcodes anywhere on the floor.
                </motion.p>

                <ul className="mt-4 space-y-1.5">
                  {PROOF_POINTS.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-[14.5px] font-semibold text-slate-900">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00875F]" aria-hidden />
                      {point}
                    </li>
                  ))}
                </ul>

                {/* Local-first honest value badge */}
                <div className="mt-4 inline-flex items-start gap-3 rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 shadow-sm backdrop-blur-sm">
                  <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-[#00875F]" aria-hidden />
                  <span className="text-[13px] font-bold text-slate-900">
                    Your data stays in your store &middot; Keeps working when the internet is down
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <VerifoneBadge />
                  {/* The two platforms, as the way in: a visitor who recognises the icon wants the file. */}
                  <Link
                    href="/download"
                    className="group inline-flex min-h-11 items-center gap-2.5 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-[13px] font-bold text-slate-900 shadow-sm transition-colors hover:border-[#1A63F4] hover:text-[#1A63F4]"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0078D4] text-white">
                      <WindowsIcon className="h-3.5 w-3.5" />
                    </span>
                    {/* Play, not the Android robot: the phone app is listed, and the robot reads as a sideload. */}
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
                      <GooglePlayIcon className="h-3.5 w-3.5" />
                    </span>
                    <span>
                      Download<span className="sr-only"> StoreDesk for Windows and Android</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>

                <div className="mt-8 flex flex-wrap gap-3.5">
                  <Link
                    href="/how-it-works"
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00875F] px-6 py-3.5 text-[15.5px] font-bold text-white shadow-[0_8px_22px_-8px_rgba(26,99,244,0.6)] transition-[filter,transform] hover:-translate-y-0.5 hover:brightness-110"
                  >
                    How it works <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <a
                    href={contactMailto({ subject: "StoreDesk setup inquiry" })}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3.5 text-[15.5px] font-bold text-[#17202A] shadow-sm transition-colors hover:border-[#1A63F4] hover:text-[#1A63F4]"
                  >
                    Contact us
                  </a>
                </div>
              </div>

              <div className="flex min-w-0 flex-col items-center justify-center">
                <DeviceStage />
              </div>
            </div>
          </section>

          {/* The four parts, each a door into /product. */}
          <section aria-labelledby="apps-heading" className="bg-white py-16">
            <div className="mx-auto max-w-6xl px-6">
              <h2 id="apps-heading" className="text-3xl font-extrabold tracking-tight text-[#17202A] md:text-[36px]">
                Four parts, one store
              </h2>
              <p className="mt-2 max-w-2xl text-[16.5px] font-medium text-slate-700">
                Each one has a job. Lottery is optional and also works on its own.
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {APPS.map((app) => {
                  const Icon = app.icon;
                  return (
                    <li key={app.name}>
                      <Link
                        href={app.href}
                        className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-[#1A63F4]"
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A63F4]/10 text-[#1A63F4]">
                          <Icon className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="mt-3 text-[17px] font-bold text-[#17202A]">{app.name}</span>
                        <span className="mt-1 flex-1 text-[15px] leading-relaxed text-slate-700">{app.line}</span>
                        <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-semibold text-[#1A63F4]">
                          What it does
                          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          {/* What it is for */}
          <section className="border-y border-slate-200 bg-slate-50 py-24 text-[#17202A]">
            <div className="mx-auto grid max-w-6xl md:grid-cols-[32%_68%]">
              <div className="px-6 pb-8 md:pb-0">
                <div className="sticky top-28">
                  <div className="mb-3 h-1.5 w-14 rounded-full bg-[#00A87B]" />
                  <h2 className="text-3xl font-extrabold tracking-tight text-[#17202A] md:text-[40px]">What it is for</h2>
                  <p className="mt-3 text-[16px] font-medium leading-relaxed text-slate-700">
                    Margin you can see before you reprice, a register nothing changes behind your back,
                    and answers in the aisle.
                  </p>
                </div>
              </div>

              <div className="space-y-8 px-6 md:border-l md:border-slate-200 md:pl-10">
                <motion.article
                  initial={{ y: 16 }}
                  whileInView={{ y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3 }}
                  className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-[#1A63F4] hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00875F] font-bold text-white shadow-sm">
                      <ShieldCheck className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="text-xl font-bold text-[#17202A] sm:text-[22px]">See your margin before you reprice</h3>
                  </div>
                  <p className="mt-4 text-base font-normal leading-relaxed text-slate-700">
                    The register knows what each item sells for. Your invoices know what it cost. StoreDesk puts
                    the two side by side, per unit, so you see the margin before you change a shelf tag.
                  </p>
                </motion.article>

                <motion.article
                  initial={{ y: 16 }}
                  whileInView={{ y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.05 }}
                  className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-[#1A63F4] hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1A63F4] font-bold text-white shadow-sm">
                      <Zap className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="text-xl font-bold text-[#17202A] sm:text-[22px]">Nothing reaches the till unless you send it</h3>
                  </div>
                  <p className="mt-4 text-base font-normal leading-relaxed text-slate-700">
                    StoreDesk reads prices and sales from your Verifone Commander. An item change goes to the
                    register only when a person sends it, and StoreDesk reads it back to check. Deals and fuel
                    prices are still changed on the register. If StoreDesk stopped tomorrow, the store would keep
                    trading.
                  </p>
                </motion.article>

                <motion.article
                  initial={{ y: 16 }}
                  whileInView={{ y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-[#1A63F4] hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#00875F] font-bold text-white shadow-sm">
                      <BarChart3 className="h-5 w-5" aria-hidden />
                    </span>
                    <h3 className="text-xl font-bold text-[#17202A] sm:text-[22px]">Answers on the shop floor</h3>
                  </div>
                  <p className="mt-4 text-base font-normal leading-relaxed text-slate-700">
                    Scan a shelf tag anywhere in the store to see the shelf price, what you paid and which
                    supplier is cheapest.
                  </p>
                </motion.article>
              </div>
            </div>
          </section>

          {/* StoreDesk Mobile, screen by screen */}
          <section className="overflow-hidden bg-white py-24">
            <div className="mx-auto max-w-6xl px-6 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-[#17202A] md:text-[40px]">
                StoreDesk Mobile, screen by screen
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-[17px] font-medium text-slate-700">
                Real screens from the Android app, running against a demo store.
              </p>
            </div>

            <MobileShowcaseCarousel />
          </section>

          {/* Setup — the shape of it only; /how-it-works and the guide carry the steps. */}
          <section className="border-t border-[var(--border)] bg-[#FBFCFD] py-20">
            <div className="mx-auto max-w-6xl px-6">
              <div className="flex flex-col gap-8 rounded-[28px] border border-slate-300 bg-white p-6 sm:p-8 md:flex-row md:items-center md:justify-between md:p-10">
                <div className="max-w-xl">
                  <span className="inline-flex rounded-full bg-[#00A87B]/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#006B4B]">
                    Getting started
                  </span>
                  <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#17202A] md:text-[36px]">
                    An afternoon to set up
                  </h2>
                  <p className="mt-3 text-[16.5px] font-medium leading-relaxed text-slate-700">
                    Install on the back-office PC, point it at your register, add what you pay your suppliers,
                    then put the phone app in your staff&apos;s hands. On hardware you already own, with nothing
                    to rewire at the till.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href="/how-it-works"
                      className="rounded-full bg-[#17202A] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#1A63F4]"
                    >
                      How it works
                    </Link>
                    <a
                      href={DOCS.install}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-5 py-2.5 text-[15px] font-semibold text-[#17202A] transition-colors hover:border-[#1A63F4] hover:text-[#1A63F4]"
                    >
                      Setup guide
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </a>
                  </div>
                </div>
                <ol className="grid shrink-0 gap-3 sm:grid-cols-2 md:w-[300px] md:grid-cols-1">
                  {["Install", "Connect the register", "Add supplier costs", "Phones on the floor"].map((label, i) => (
                    <li key={label} className="flex items-center gap-3 text-[15.5px] font-semibold text-[#17202A]">
                      <span
                        className="sd-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1A63F4]/10 text-[13px] text-[#1A63F4]"
                        aria-hidden
                      >
                        {i + 1}
                      </span>
                      {label}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </MotionConfig>
  );
}
