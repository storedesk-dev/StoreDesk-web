"use client";

import Image from "next/image";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { BarChart3, Scan } from "lucide-react";

/** Ultra-Polished 3D Mobile Phone Device Model displaying live Dashboard UI */
export function DeviceStage() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Dynamic 3D tilt response mapped to cursor movement
  const rotateX = useTransform(y, [-150, 150], [9, -9]);
  const rotateY = useTransform(x, [-150, 150], [-9, 9]);
  const glowX = useTransform(x, [-150, 150], [-25, 25]);
  const glowY = useTransform(y, [-150, 150], [-25, 25]);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - rect.width / 2;
    const offsetY = event.clientY - rect.top - rect.height / 2;
    x.set(offsetX);
    y.set(offsetY);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <div
      className="relative flex min-h-[460px] w-full items-center justify-center py-6 perspective-[1200px]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Multi-layered Ambient Light & Glow Backdrop */}
      <motion.div
        className="pointer-events-none absolute h-80 w-80 rounded-full bg-gradient-to-tr from-[#00B36B]/35 via-[#1D4ED8]/25 to-emerald-400/20 blur-3xl"
        style={{ x: glowX, y: glowY }}
      />
      <div className="pointer-events-none absolute h-64 w-64 rounded-full bg-[#1D4ED8]/20 blur-2xl" />

      {/* Floating Callout Badges around 3D Phone */}
      <motion.div
        className="absolute -left-2 top-12 z-30 hidden rounded-2xl border border-white/80 bg-white/90 p-3 shadow-xl backdrop-blur-md sm:flex items-center gap-2.5"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#00B36B] text-white shadow-md">
          <Scan className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Scan Ready</p>
          <p className="text-xs font-extrabold text-[#0B1F4D]">Instant UPC Lookup</p>
        </div>
      </motion.div>

      <motion.div
        className="absolute -right-2 bottom-14 z-30 hidden rounded-2xl border border-white/80 bg-white/90 p-3 shadow-xl backdrop-blur-md sm:flex items-center gap-2.5"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1D4ED8] text-white shadow-md">
          <BarChart3 className="h-4 w-4" />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Live Register</p>
          <p className="text-xs font-extrabold text-[#00B36B]">Sales & Tax Dashboard</p>
        </div>
      </motion.div>

      {/* 3D Floating Phone Device Container */}
      <motion.div
        className="relative z-10 w-[275px] sm:w-[295px]"
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, y: 36, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Phone Outer Metallic Chassis with Dual Bevel */}
        <motion.div
          className="relative rounded-[3.2rem] border-[9px] border-slate-900 bg-slate-950 p-1.5 shadow-[0_30px_70px_-15px_rgba(11,31,77,0.35)] ring-2 ring-white/30"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Side Hardware Buttons */}
          <div className="absolute -left-[13px] top-24 h-10 w-[4px] rounded-l-md bg-slate-800" />
          <div className="absolute -left-[13px] top-38 h-10 w-[4px] rounded-l-md bg-slate-800" />
          <div className="absolute -right-[13px] top-32 h-14 w-[4px] rounded-r-md bg-slate-800" />

          {/* Screen Shell */}
          <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950">
            {/* Dynamic Island / Speaker Notch */}
            <div className="relative z-20 bg-slate-900/90 px-4 pb-1 pt-2.5 backdrop-blur-md">
              <div className="absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-950 flex items-center justify-end px-2">
                <div className="h-2 w-2 rounded-full bg-slate-800 ring-1 ring-slate-700" />
              </div>
              <div className="flex items-center justify-between text-[8px] font-bold text-slate-300">
                <span>9:41</span>
                <span>StoreDesk · 5G</span>
              </div>
            </div>

            {/* Core Sales Tax & Analytics Mobile Dashboard UI Screenshot */}
            <div className="relative overflow-hidden bg-slate-900">
              <Image
                src="/screenshots/mobile-app-5.jpeg"
                alt="StoreDesk Mobile Sales Tax & Analytics Dashboard UI"
                width={440}
                height={900}
                className="h-auto w-full object-cover transition-transform duration-500 hover:scale-105"
                priority
              />

              {/* Glossy Glass Reflection Sheen */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent" />
            </div>

            {/* Home Bar */}
            <div className="relative z-20 flex justify-center bg-slate-950 py-1.5">
              <div className="h-1 w-24 rounded-full bg-slate-700" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
