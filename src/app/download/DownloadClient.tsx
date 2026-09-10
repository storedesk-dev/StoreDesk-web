"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, KeyRound } from "lucide-react";
import { AndroidIcon, WindowsIcon } from "@/components/BrandIcons";
import { PageFrame, PageHero } from "@/components/PageHero";
import { PLANS, contactMailto } from "@/lib/site";

/** Kept in step with the Electron app's package version. */
export const LATEST_RELEASE_TAG = "v0.0.4";

const RELEASE_BASE = `https://github.com/TRUPALIX9/StoreDesk/releases/download/${LATEST_RELEASE_TAG}`;

type Platform = "windows" | "android";

const INSTALLERS: Array<{
  platform: Platform;
  name: string;
  requirement: string;
  body: string;
  href: string;
  cta: string;
  footnote: string;
}> = [
  {
    platform: "windows",
    name: "StoreDesk for Windows",
    requirement: "Windows 10 or later",
    body: "Install on the PC that can reach your register over the store network. It holds your catalogue and sales history, and the phone app connects back to it.",
    href: `${RELEASE_BASE}/StoreDesk.Windows.Setup.exe`,
    cta: "Download for Windows",
    footnote: "Windows asks once for permission to install the background service."
  },
  {
    platform: "android",
    name: "StoreDesk for Android",
    requirement: "Android 5.0 or later",
    body: "For the shop floor: scan a shelf tag to see the price, the cost and the margin. Install it after the store PC is connected.",
    href: `${RELEASE_BASE}/app-release.apk`,
    cta: "Download the APK",
    footnote: "Installing outside the Play Store means allowing it once in Android settings."
  }
];

function PlatformBadge({ platform }: { platform: Platform }) {
  return platform === "windows" ? (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0078D4] text-white shadow-[0_8px_20px_-8px_rgba(0,120,212,0.7)]">
      <WindowsIcon className="h-6 w-6" />
    </span>
  ) : (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3DDC84] text-[#073042] shadow-[0_8px_20px_-8px_rgba(61,220,132,0.8)]">
      <AndroidIcon className="h-7 w-7" />
    </span>
  );
}

function Installers() {
  // Detected after mount so the server HTML and first client render agree.
  const [detected, setDetected] = useState<Platform | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) setDetected("android");
    else if (/Windows/i.test(ua)) setDetected("windows");
  }, []);

  return (
    <div className="space-y-4">
      {INSTALLERS.map((it) => (
        <div
          key={it.platform}
          className={`rounded-[26px] border bg-white/90 p-6 backdrop-blur-xl transition-shadow ${
            detected === it.platform
              ? "border-[#1A63F4]/45 shadow-[0_24px_60px_-28px_rgba(26,99,244,0.55)]"
              : "border-white/80 shadow-[0_20px_50px_-30px_rgba(23,32,42,0.35)]"
          }`}
        >
          <div className="flex items-start gap-4">
            <PlatformBadge platform={it.platform} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[20px] font-bold tracking-tight">{it.name}</h2>
                {detected === it.platform ? (
                  <span className="rounded-full bg-[#00A87B]/12 px-2.5 py-0.5 text-[12px] font-semibold text-[#00875F]">
                    For this device
                  </span>
                ) : null}
              </div>
              <p className="sd-num mt-0.5 text-[13px] text-[var(--muted)]">
                {it.requirement} · {LATEST_RELEASE_TAG}
              </p>
            </div>
          </div>
          <p className="mt-4 text-[16px] leading-relaxed text-[#344054]">{it.body}</p>
          <a
            href={it.href}
            className={`mt-5 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15.5px] font-semibold text-white transition-[filter] hover:brightness-110 ${
              it.platform === "windows" ? "bg-[#0078D4]" : "bg-[#00875F]"
            }`}
          >
            <ArrowDownToLine className="h-4 w-4" />
            {it.cta}
          </a>
          <p className="mt-2.5 text-center text-[13px] text-[var(--muted)]">{it.footnote}</p>
        </div>
      ))}
    </div>
  );
}

const ORDER = [
  { title: "Windows first", body: "Install on the back-office PC and enter your setup key." },
  { title: "Connect the register", body: "Enter the Commander’s address — usually 192.168.31.11, port 443." },
  { title: "Then the phones", body: "Install the Android app and sign in against your store." }
];

export function DownloadClient() {
  return (
    <PageFrame>
      <PageHero
        eyebrow="Download"
        title="Install on the back-office PC first"
        lede="The Windows app sets everything up. Add the phone app afterwards, once the store is connected."
        aside={<Installers />}
      >
        <ol className="mt-7 space-y-3">
          {ORDER.map((o, i) => (
            <li key={o.title} className="flex gap-3.5">
              <span className="sd-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1A63F4] to-[#00A87B] text-[13px] font-semibold text-white">
                {i + 1}
              </span>
              <p className="text-[16px] leading-snug">
                <span className="font-semibold">{o.title}.</span>{" "}
                <span className="text-[var(--muted)]">{o.body}</span>
              </p>
            </li>
          ))}
        </ol>
      </PageHero>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-5 rounded-[28px] border border-[#1A63F4]/20 bg-white p-7 sm:flex-row sm:items-center sm:justify-between md:p-8">
          <div className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1A63F4]/10 text-[#1A63F4]">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[19px] font-bold tracking-tight">You need a setup key before you start</h2>
              <p className="mt-1.5 max-w-xl text-[16px] leading-relaxed text-[var(--muted)]">
                We email it when your store is set up on our side. It is good for {PLANS.setupKeyHours} hours
                and works once — if yours has expired, ask and we will send another.
              </p>
            </div>
          </div>
          <a
            href={contactMailto({ subject: "StoreDesk — setup key" })}
            className="shrink-0 rounded-full bg-[#17202A] px-5 py-3 text-center text-[15px] font-semibold text-white hover:bg-[#1A63F4]"
          >
            Request a key
          </a>
        </div>
        <p className="mt-6 text-[15px] text-[var(--muted)]">
          There is no iPhone version yet. macOS and Linux can run the desktop app for development, but the
          background service that keeps it running is Windows-only today.
        </p>
      </section>
    </PageFrame>
  );
}
