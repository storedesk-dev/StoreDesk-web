"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Download, KeyRound, Smartphone } from "lucide-react";
import { MarketingShell } from "@/components/MarketingShell";
import { PLANS, contactMailto } from "@/lib/site";

/** Kept in step with the Electron app's package version. */
export const LATEST_RELEASE_TAG = "v0.0.4";

const RELEASE_BASE = `https://github.com/TRUPALIX9/StoreDesk/releases/download/${LATEST_RELEASE_TAG}`;

export function DownloadClient() {
  const reduceMotion = useReducedMotion();
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 12 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reduceMotion ? 0 : 0.42,
      delay: reduceMotion ? 0 : delay,
      ease: [0.22, 1, 0.36, 1] as const
    }
  });

  return (
    <MarketingShell
      eyebrow="Download"
      title="Install on the back-office PC first"
      lede="The desktop app sets everything up. Add the phone app afterwards, once the store is connected."
    >
      {/* The setup key is the part people get stuck on, so it leads. */}
      <motion.div
        {...rise(0)}
        className="flex flex-col gap-4 rounded-2xl border border-[#1A63F4]/20 bg-[#1A63F4]/[0.04] p-6 sm:flex-row sm:items-center sm:justify-between md:p-7"
      >
        <div className="flex gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1A63F4]/10 text-[#1A63F4]">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight">
              You need a setup key before you start
            </h2>
            <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-[var(--muted)]">
              We email it when your store is set up on our side. It is good for{" "}
              {PLANS.setupKeyHours} hours and works once — if yours has expired, ask and we
              will send another straight away.
            </p>
          </div>
        </div>
        <a
          href={contactMailto({ subject: "StoreDesk — setup key" })}
          className="shrink-0 rounded-lg bg-[#1A63F4] px-4 py-2.5 text-center text-[14px] font-semibold text-white transition-colors hover:bg-[#0E43D8]"
        >
          Request a key
        </a>
      </motion.div>

      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-2">
        <motion.div {...rise(0.08)} className="flex flex-col bg-white p-7 md:p-8">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A63F4]/8 text-[#1A63F4]">
            <Download className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-[18px] font-semibold tracking-tight">StoreDesk for Windows</h2>
          <p className="mt-1 text-[13px] font-medium text-[var(--muted)]">
            Windows 10 or later · {LATEST_RELEASE_TAG}
          </p>
          <p className="mt-3 flex-1 text-[14.5px] leading-relaxed text-[var(--muted)]">
            Install this on the PC that can reach your register over the store network. It
            holds your catalogue and sales history, and it is what the phone app connects
            back to.
          </p>
          <a
            href={`${RELEASE_BASE}/StoreDesk.Windows.Setup.exe`}
            className="mt-6 rounded-lg bg-[#1A63F4] px-4 py-3 text-center text-[14.5px] font-semibold text-white transition-colors hover:bg-[#0E43D8]"
          >
            Download for Windows
          </a>
          <p className="mt-2.5 text-center text-[12.5px] text-[var(--muted)]">
            Windows will ask for permission to install a background service.
          </p>
        </motion.div>

        <motion.div {...rise(0.14)} className="flex flex-col bg-white p-7 md:p-8">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#00A87B]/10 text-[#00875F]">
            <Smartphone className="h-5 w-5" />
          </span>
          <h2 className="mt-4 text-[18px] font-semibold tracking-tight">StoreDesk for Android</h2>
          <p className="mt-1 text-[13px] font-medium text-[var(--muted)]">
            Android 5.0 or later · {LATEST_RELEASE_TAG}
          </p>
          <p className="mt-3 flex-1 text-[14.5px] leading-relaxed text-[var(--muted)]">
            For the shop floor. Scan a shelf tag to see the price, what you paid and the
            margin. Install it after the store PC is connected — it signs in against your
            store.
          </p>
          <a
            href={`${RELEASE_BASE}/app-release.apk`}
            className="mt-6 rounded-lg bg-[#00875F] px-4 py-3 text-center text-[14.5px] font-semibold text-white transition-colors hover:bg-[#00A87B]"
          >
            Download the APK
          </a>
          <p className="mt-2.5 text-center text-[12.5px] text-[var(--muted)]">
            Installing outside the Play Store means allowing it once in Android settings.
          </p>
        </motion.div>
      </div>

      <p className="mt-8 text-[13.5px] text-[var(--muted)]">
        There is no iPhone version yet. macOS and Linux can run the desktop app for
        development, but the background service that keeps it running is Windows-only today.
      </p>
    </MarketingShell>
  );
}
