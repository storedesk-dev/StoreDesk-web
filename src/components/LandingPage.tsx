"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { DeviceStage } from "@/components/DeviceStage";
import { SiteHeader } from "@/components/SiteChrome";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { SITE, contactMailto } from "@/lib/site";
import {
  HardDrive,
  Sparkles,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Zap,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Scan,
  Receipt,
  Search,
  DollarSign
} from "lucide-react";

/** Official Tech Brand SVG Logos */
function ReactElectronLogo() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="2.2" fill="#61DAFB" />
      <ellipse cx="12" cy="12" rx="7.5" ry="3" stroke="#61DAFB" strokeWidth="1.5" transform="rotate(30 12 12)" />
      <ellipse cx="12" cy="12" rx="7.5" ry="3" stroke="#61DAFB" strokeWidth="1.5" transform="rotate(90 12 12)" />
      <ellipse cx="12" cy="12" rx="7.5" ry="3" stroke="#61DAFB" strokeWidth="1.5" transform="rotate(150 12 12)" />
    </svg>
  );
}

function NodeJsLogo() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L3.5 7v10L12 22l8.5-5V7L12 2z" fill="#5FA04E" opacity="0.2" stroke="#5FA04E" strokeWidth="1.5" />
      <path d="M12 6.5L6.5 9.75v6.5L12 19.5l5.5-3.25v-6.5L12 6.5z" fill="#5FA04E" />
    </svg>
  );
}

function GcpCloudLogo() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="#4285F4" />
    </svg>
  );
}

function NextMongoLogo() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 9h-1.5l-5.5-7.2v7.2H11z" fill="#0B1F4D" />
      <path d="M13.5 6.5l3.5 4.5" stroke="#47A248" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Rotating words for hero focus pill */
const FLIP_WORDS = [
  "No stock counts required",
  "Verifone Commander read-only",
  "Wholesale vendor cost overlays",
  "Instant floor UPC scanning"
];

/** 6 Validated App Screens mapped from project wireframes */
const validatedScreens = [
  {
    id: "login",
    src: "/screenshots/mobile-app-1.jpeg",
    title: "StoreDesk Login",
    subtitle: "Secure Store Authentication",
    desc: "Authentication screen for store staff and managers with organization-provisioned AppUser credentials.",
    tag: "Core UI",
    icon: Smartphone
  },
  {
    id: "analytics",
    src: "/screenshots/mobile-app-5.jpeg",
    title: "Sales Tax & Analytics",
    subtitle: "Live Shift & Category Feed",
    desc: "Dashboard featuring sales breakdowns, hourly trends, category breakdown, and live shift transaction feed.",
    tag: "Analytics",
    icon: BarChart3
  },
  {
    id: "sync",
    src: "/screenshots/mobile-app-6.jpeg",
    title: "Transaction & Register Sync",
    subtitle: "Real-time Receipt Breakdown",
    desc: "Detailed view of specific cash register transactions, line items, taxes, and subtotal calculation.",
    tag: "Live Feed",
    icon: Receipt
  },
  {
    id: "scanner",
    src: "/screenshots/mobile-app-2.jpeg",
    title: "Barcode Scanner & Search",
    desc: "Price Book catalog with instant UPC camera scanner trigger and fast search by name, brand, or department.",
    subtitle: "Instant Camera Lookup",
    tag: "Scan First",
    icon: Scan
  },
  {
    id: "details",
    src: "/screenshots/mobile-app-3.jpeg",
    title: "Product Details & Comparison",
    subtitle: "PLU & Vendor Cost Overlay",
    desc: "Live PLU details showing selling price, department tax categories, unit size, and wholesale supplier cost.",
    tag: "Price Book",
    icon: Search
  },
  {
    id: "vendor",
    src: "/screenshots/mobile-app-4.jpeg",
    title: "Vendor Prices & Cost Breakdown",
    subtitle: "True Margin Transparency",
    desc: "Cost analysis overlay comparing retail prices against local vendor costs to calculate true profit margins.",
    tag: "Margin Control",
    icon: DollarSign
  }
];

const techStack = [
  {
    name: "Electron & React",
    role: "Desktop Command Center",
    desc: "Primary command center UI for store managers connecting to local Edge Agent or Cloud Hub.",
    LogoComponent: ReactElectronLogo,
    badge: "Desktop App",
    bgColor: "bg-slate-900"
  },
  {
    name: "Node.js & Express",
    role: "Local Edge Agent",
    desc: "Acts as outbound Edge Agent on local Store PC reading directly from Verifone Commander.",
    LogoComponent: NodeJsLogo,
    badge: "Edge Agent",
    bgColor: "bg-emerald-950/20 border-emerald-500/20"
  },
  {
    name: "GCP Cloud Run & WebSockets",
    role: "Real-Time Cloud Hub",
    desc: "Central WebSocket hub maintaining dynamic event-driven rooms keyed by store_id.",
    LogoComponent: GcpCloudLogo,
    badge: "Cloud Hub",
    bgColor: "bg-blue-950/20 border-blue-500/20"
  },
  {
    name: "Next.js & MongoDB",
    role: "Web Portal & Admin",
    desc: "Vercel-hosted marketing portal and internal company admin for licenses & telemetry.",
    LogoComponent: NextMongoLogo,
    badge: "Web Portal",
    bgColor: "bg-[#0B1F4D]/10 border-slate-300"
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

/** Animated Number Counter Component */
function AnimatedCounter({ value, prefix = "$", decimals = 2 }: { value: number; prefix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const start = 0;
    const duration = 1200; // ms
    const startTime = performance.now();

    function update(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(start + eased * (value - start));

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }, [isInView, value]);

  return (
    <span ref={ref} className="font-mono font-bold">
      {prefix}
      {displayValue.toFixed(decimals)}
    </span>
  );
}

/** Linear-style Spotlight Card Component */
function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:border-[#1D4ED8] hover:shadow-md ${className}`}
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useTransform(
            [mouseX, mouseY],
            ([x, y]) => `radial-gradient(400px circle at ${x}px ${y}px, rgba(0,179,107,0.12), transparent 80%)`
          )
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

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
        <div className="pointer-events-none absolute h-72 w-72 rounded-full bg-gradient-to-tr from-[#00B36B]/20 via-[#1D4ED8]/20 to-sky-400/20 blur-3xl" />

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
                <AnimatePresence mode="wait">
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
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
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
                  i === activeIndex ? "w-8 bg-[#1D4ED8]" : "w-2.5 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Go to screen ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
            aria-label="Next Screen"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Screen Selector Pills & Active Feature Spotlight */}
      <div className="space-y-4">
        <div className="mb-2">
          <span className="inline-flex rounded-full bg-[#00B36B]/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#00B36B]">
            INTERACTIVE APP PREVIEW
          </span>
          <h3 className="mt-2 text-2xl font-extrabold text-[#0B1F4D] sm:text-3xl">
            {activeScreen.title}
          </h3>
          <p className="mt-1 text-sm font-semibold text-[#1D4ED8]">
            {activeScreen.subtitle}
          </p>
        </div>

        <motion.div
          key={activeScreen.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-slate-300 bg-slate-50 p-6 shadow-sm"
        >
          <p className="text-base font-medium leading-relaxed text-slate-800">
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
                    ? "border-[#1D4ED8] bg-[#1D4ED8] text-white shadow-md"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-[#0B1F4D]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{screen.title}</p>
                  <p
                    className={`truncate text-[10px] ${
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

  useEffect(() => {
    const timer = setInterval(() => {
      setFlipIndex((prev) => (prev + 1) % FLIP_WORDS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#0B1F4D] antialiased selection:bg-[#00B36B] selection:text-white">
      {/* 1. HEADER / GLOBAL NAVIGATION */}
      <SiteHeader />

      {/* 2. HERO SECTION - Rich Polished Background Mesh */}
      <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-100/60 via-[#F8FAFC] to-white pb-20 pt-10">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#0b1f4d08_1px,transparent_1px),linear-gradient(to_bottom,#0b1f4d08_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:pb-12">
          {/* Left Column - 50% */}
          <div>
            <motion.div
              className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#00B36B]/15 px-3.5 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#00B36B]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00B36B] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00B36B]" />
              </span>
              CONVENIENCE · GAS · C-STORE MANAGEMENT
            </motion.div>

            {/* Stable Non-Wobbling Headline */}
            <motion.h1
              className="text-4xl font-extrabold tracking-tight text-[#0B1F4D] sm:text-5xl lg:text-[3.25rem] lg:leading-[1.15]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              Built for store operators —{" "}
              <span className="bg-gradient-to-r from-[#00B36B] via-[#00A87B] to-[#1D4ED8] bg-clip-text text-transparent">
                not generic retail SaaS.
              </span>
            </motion.h1>

            <motion.p
              className="mt-5 max-w-md text-base leading-relaxed text-slate-700 font-medium sm:text-lg"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Manage vendor pricing, compare wholesale costs, calculate shelf prices, and inspect register transactions in real-time from your back-office computer and store devices.
            </motion.p>

            {/* Dynamic Focus Feature Pill */}
            <motion.div
              className="mt-4 flex h-8 items-center gap-2 text-xs font-bold text-[#00B36B]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.11 }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00B36B]" />
              <div className="relative overflow-hidden h-5 w-64">
                <AnimatePresence mode="wait">
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

            {/* Live Ticker Metric Spotlight */}
            <motion.div
              className="mt-4 inline-flex items-center gap-3 rounded-xl border border-slate-300 bg-white/90 px-3.5 py-2 shadow-sm backdrop-blur-sm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <TrendingUp className="h-4 w-4 text-[#00B36B]" />
              <span className="text-xs font-bold text-slate-900">
                Live Net Shift Sync: <AnimatedCounter value={356.2} />
              </span>
            </motion.div>

            {/* Badges Flex Row */}
            <motion.div
              className="mt-5 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.13 }}
            >
              <VerifoneBadge />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-sm">
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
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1D4ED8] px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 hover:shadow-lg"
                >
                  How it works <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                <a
                  href={contactMailto({ subject: "StoreDesk setup inquiry" })}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-[#0B1F4D] shadow-sm transition hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
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

      {/* 3. CORE PURPOSE (High-Contrast Solid Navy #0B1F4D) */}
      <section className="bg-[#0B1F4D] py-24 text-white">
        <div className="mx-auto grid max-w-6xl md:grid-cols-[32%_68%]">
          {/* Left Column - 32% Sticky Scrollytelling */}
          <div className="px-6 pb-8 md:pb-0">
            <div className="sticky top-28">
              <div className="mb-3 h-1.5 w-14 rounded-full bg-[#00B36B] shadow-[0_0_12px_#00B36B]" />
              <h2 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">Why StoreDesk exists</h2>
              <p className="mt-3 text-sm font-medium leading-relaxed text-slate-200">
                Read-only Price Book reference and margin overlays built specifically for convenience stores and gas stations.
              </p>
            </div>
          </div>

          {/* Right Column - 68% High-Contrast Feature Cards */}
          <div className="space-y-8 px-6 md:border-l md:border-white/20 md:pl-10">
            <motion.article
              initial={{ opacity: 1, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/20 bg-slate-900/80 p-7 shadow-xl backdrop-blur-md transition duration-300 hover:border-[#00B36B] hover:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00B36B] text-white font-bold shadow-md">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-extrabold text-white sm:text-2xl">Protect profit margins against rising costs</h3>
              </div>
              <p className="mt-4 text-base font-normal leading-relaxed text-slate-100">
                Retail prices live on your cash register while wholesale costs live in vendor invoices. StoreDesk connects those two worlds so true per-unit profit margins are transparent before changing shelf labels.
              </p>
            </motion.article>

            <motion.article
              initial={{ opacity: 1, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="rounded-2xl border border-white/20 bg-slate-900/80 p-7 shadow-xl backdrop-blur-md transition duration-300 hover:border-[#00B36B] hover:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1D4ED8] text-white font-bold shadow-md">
                  <Zap className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-extrabold text-white sm:text-2xl">Read-only POS register integration</h3>
              </div>
              <p className="mt-4 text-base font-normal leading-relaxed text-slate-100">
                Integrates safely with Verifone Commander via read-only register streams (<code className="rounded bg-[#00B36B]/20 px-2 py-0.5 font-mono text-xs font-bold text-[#00FF95] border border-[#00B36B]/40">vPLUs</code>, <code className="rounded bg-[#00B36B]/20 px-2 py-0.5 font-mono text-xs font-bold text-[#00FF95] border border-[#00B36B]/40">vrubyrept</code>, <code className="rounded bg-[#00B36B]/20 px-2 py-0.5 font-mono text-xs font-bold text-[#00FF95] border border-[#00B36B]/40">vtransset</code>). Zero risk to register configurations or cash register performance.
              </p>
            </motion.article>

            <motion.article
              initial={{ opacity: 1, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="rounded-2xl border border-white/20 bg-slate-900/80 p-7 shadow-xl backdrop-blur-md transition duration-300 hover:border-[#00B36B] hover:bg-slate-900"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00B36B] text-white font-bold shadow-md">
                  <BarChart3 className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-extrabold text-white sm:text-2xl">Fast floor access & scan lookup</h3>
              </div>
              <p className="mt-4 text-base font-normal leading-relaxed text-slate-100">
                Scan barcodes anywhere in the store to instantly inspect wholesale cost per item, department tax breakdown, best supplier cost, and suggested retail price.
              </p>
            </motion.article>
          </div>
        </div>
      </section>

      {/* 4. APPLICATION INTERFACE (Single 3D Phone Showcase Carousel) */}
      <section className="bg-white py-24 overflow-hidden">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0B1F4D] md:text-4xl">
            Designed for speed at the counter & on the floor
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base font-medium text-slate-700">
            Explore the key validated screens of StoreDesk — featuring live register analytics, barcode scanning, price book catalog, and margin overlays.
          </p>
        </div>

        {/* Single 3D Phone Circular Showcase Carousel */}
        <MobileShowcaseCarousel />
      </section>

      {/* 5. ARCHITECTURE OVERVIEW (Background: Light Ice-Blue #F0F8FF) */}
      <section className="bg-[#F0F8FF] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <span className="inline-flex rounded-full bg-[#00B36B]/15 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#00B36B]">
              SYSTEM TOPOGRAPHY
            </span>
            <h2 className="mt-3 text-[#0B1F4D] text-3xl font-extrabold tracking-tight md:text-4xl">
              Modern Event-Driven Technology Stack
            </h2>
          </div>

          {/* 4-Column Grid with Tech Brand SVG Logos */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {techStack.map((tech) => {
              const Logo = tech.LogoComponent;
              return (
                <SpotlightCard key={tech.name}>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex rounded-xl bg-[#0B1F4D] p-2.5 text-white shadow-md ring-1 ring-slate-800">
                      <Logo />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-[#0B1F4D]">
                      {tech.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold text-[#0B1F4D]">{tech.name}</h3>
                  <p className="text-xs font-semibold text-[#1D4ED8]">{tech.role}</p>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-slate-700">{tech.desc}</p>
                </SpotlightCard>
              );
            })}
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
                className="group rounded-2xl border border-slate-300 bg-white p-6 shadow-sm transition hover:border-[#1D4ED8] hover:shadow-md"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="inline-flex rounded-full bg-[#1D4ED8]/10 px-3 py-1 font-mono text-xs font-bold text-[#1D4ED8]">
                  Step {s.n}
                </span>
                <h3 className="mt-3 text-xl font-bold text-[#0B1F4D]">{s.title}</h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700">{s.body}</p>
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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00B36B] text-white shadow-md">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-3xl font-extrabold tracking-tight text-[#0B1F4D]">Ready to set up your store?</h3>
            <p className="mx-auto mt-3 max-w-lg text-sm font-medium text-slate-700">
              Get in touch to bring StoreDesk to your back-office computer and store devices.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3.5">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                <a
                  href={contactMailto({ subject: "StoreDesk Setup Inquiry" })}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1D4ED8] px-7 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700"
                >
                  Open email
                </a>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-sm font-bold text-[#0B1F4D] shadow-sm transition hover:border-[#1D4ED8]"
                >
                  How it works
                </Link>
              </motion.div>
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
              <p className="max-w-sm text-xs font-normal leading-relaxed text-slate-200">
                Read-only price book management, wholesale vendor cost overlays, and register margin analysis for convenience stores and gas stations.
              </p>
              <p className="mt-6 text-xs text-slate-300">
                © 2026 StoreDesk. Built for convenience stores & gas stations.
              </p>
            </div>

            {/* Center */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#00B36B]">Explore</h4>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-200">
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
              <div className="mt-6 flex gap-4 text-xs text-slate-200">
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
