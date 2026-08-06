"use client";

import Image from "next/image";
import { motion, useMotionValue, useTransform } from "framer-motion";

/** Premium 3D Standalone Mobile Phone Device Stage */
export function DeviceStage() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Dynamic 3D tilt response mapped to cursor movement
  const rotateX = useTransform(y, [-150, 150], [8, -8]);
  const rotateY = useTransform(x, [-150, 150], [-8, 8]);
  const glowX = useTransform(x, [-150, 150], [-20, 20]);
  const glowY = useTransform(y, [-150, 150], [-20, 20]);

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
      className="relative flex min-h-[440px] w-full items-center justify-center py-6 perspective-[1200px]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Dynamic Ambient Emerald Glow Backdrop */}
      <motion.div
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-gradient-to-tr from-[#00B36B]/30 to-[#1D4ED8]/30 blur-3xl"
        style={{ x: glowX, y: glowY }}
      />

      {/* 3D Floating Phone Device Container */}
      <motion.div
        className="relative z-10 w-[270px] sm:w-[290px]"
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        initial={{ opacity: 0, y: 36, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Floating Vertical Bobbing Animation */}
        <motion.div
          className="relative rounded-[3rem] border-[8px] border-slate-900 bg-slate-950 p-1.5 shadow-[0_25px_60px_-15px_rgba(0,179,107,0.3)] ring-1 ring-white/20"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Side Hardware Buttons */}
          <div className="absolute -left-[12px] top-24 h-10 w-[4px] rounded-l-md bg-slate-800" />
          <div className="absolute -left-[12px] top-38 h-10 w-[4px] rounded-l-md bg-slate-800" />
          <div className="absolute -right-[12px] top-32 h-14 w-[4px] rounded-r-md bg-slate-800" />

          <div className="relative overflow-hidden rounded-[2.3rem] bg-slate-950">
            {/* Status Bar / Dynamic Island Notch */}
            <div className="relative z-20 bg-slate-900/90 px-4 pb-1 pt-2.5 backdrop-blur-md">
              <div className="absolute left-1/2 top-2 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-950 flex items-center justify-end px-2">
                <div className="h-2 w-2 rounded-full bg-slate-800 ring-1 ring-slate-700" />
              </div>
              <div className="flex items-center justify-between text-[9px] font-bold text-slate-300">
                <span>9:41</span>
                <span>StoreDesk · 5G</span>
              </div>
            </div>

            {/* Core Mobile Dashboard & Login UI Mockup */}
            <div className="relative overflow-hidden bg-slate-900">
              <Image
                src="/screenshots/mobile-app-1.jpeg"
                alt="StoreDesk Mobile App Dashboard UI"
                width={440}
                height={900}
                className="h-auto w-full object-cover transition-transform duration-500 hover:scale-105"
                priority
              />

              {/* Glossy Glass Reflection Overlay */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
            </div>

            {/* Bottom Indicator Bar */}
            <div className="relative z-20 flex justify-center bg-slate-950 py-1.5">
              <div className="h-1 w-24 rounded-full bg-slate-700" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
