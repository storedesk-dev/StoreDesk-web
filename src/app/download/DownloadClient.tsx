"use client";

import { MarketingShell } from "@/components/MarketingShell";
import { Download, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

export function DownloadClient() {
  return (
    <MarketingShell eyebrow="Downloads" title="Get StoreDesk for your devices">
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Desktop Download */}
        <motion.div
          className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white/95 p-6 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1A63F4] to-[#0E43D8] text-white">
              <Download className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-xl font-bold">StoreDesk Desktop</h3>
              <p className="text-sm text-[var(--muted)]">For Windows PC</p>
            </div>
          </div>
          <p className="text-[var(--muted)]">
            The local store connection and dashboard. Run this on your back-office PC where your Verifone Commander is connected.
          </p>
          <a
            href="https://github.com/TRUPALIX9/StoreDesk/releases/download/v0.0.1/StoreDesk.Setup.1.0.0.exe"
            className="mt-auto block rounded-lg bg-gradient-to-r from-[#1A63F4] to-[#0E43D8] px-4 py-3 text-center font-bold text-white shadow-md hover:brightness-105"
          >
            Download Windows Setup (.exe)
          </a>
        </motion.div>

        {/* Mobile Download */}
        <motion.div
          className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white/95 p-6 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#00A87B] to-[#28C88B] text-white">
              <Smartphone className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-xl font-bold">StoreDesk Mobile</h3>
              <p className="text-sm text-[var(--muted)]">For Android Devices</p>
            </div>
          </div>
          <p className="text-[var(--muted)]">
            The floor scanner companion app. Walk your store, scan shelf barcodes, check prices, and review profit margins instantly.
          </p>
          <a
            href="https://github.com/TRUPALIX9/StoreDesk/releases/download/v0.0.1/app-release.apk"
            className="mt-auto block rounded-lg bg-gradient-to-r from-[#00A87B] to-[#28C88B] px-4 py-3 text-center font-bold text-white shadow-md hover:brightness-105"
          >
            Download Android App (.apk)
          </a>
        </motion.div>
      </div>
    </MarketingShell>
  );
}
