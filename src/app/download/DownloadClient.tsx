"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, Check, Copy, KeyRound, ShieldAlert } from "lucide-react";
import { AndroidIcon, WindowsIcon } from "@/components/BrandIcons";
import { InfoTip } from "@/components/InfoTip";
import { PageFrame, PageHero } from "@/components/PageHero";
import { PLANS, contactMailto } from "@/lib/site";
import {
  ANDROID_APK_URL,
  LATEST_RELEASE_TAG,
  WINDOWS_CHECKSUM_URL,
  WINDOWS_INSTALLER_FILE,
  WINDOWS_INSTALLER_URL
} from "@/lib/release";

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
    href: WINDOWS_INSTALLER_URL,
    cta: "Download for Windows",
    footnote: "Windows asks once for permission to install the background service."
  },
  {
    platform: "android",
    name: "StoreDesk for Android",
    requirement: "Android 5.0 or later",
    body: "For the shop floor: scan a shelf tag to see the price, the cost and the margin. Install it after the store PC is connected.",
    href: ANDROID_APK_URL,
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

function CopyHash({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy the SHA-256"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked: the hash is still selectable */
        }
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#D0D5DD] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#344054] hover:bg-[#F9FAFB]"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[#00875F]" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * The installer is unsigned: say what SmartScreen will show, and give the
 * SHA-256 published beside it (from the release's `.sha256` file) to check
 * the download against.
 */
function WindowsTrust({ sha256 }: { sha256: string | null }) {
  // Upper case, as PowerShell's Get-FileHash prints it.
  const hash = sha256?.toUpperCase() ?? null;
  return (
    <div className="mt-4 space-y-3 border-t border-[#E4E7EC] pt-4 text-[13px]">
      <p className="flex gap-2 text-[#344054]">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#B54708]" aria-hidden />
        <span>
          Windows may say it protected your PC: choose <span className="font-semibold">More info</span> →{" "}
          <span className="font-semibold">Run anyway</span>.
        </span>
      </p>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-[#344054]">SHA-256</span>
          <InfoTip label="How to check">
            In PowerShell, where you saved it:{" "}
            <code className="font-mono">Get-FileHash .\{WINDOWS_INSTALLER_FILE} -Algorithm SHA256</code> — the Hash should match this one.
          </InfoTip>
        </div>
        {hash ? (
          <div className="mt-1.5 flex items-start gap-2">
            <code className="sd-num min-w-0 flex-1 break-all rounded-lg bg-[#F2F4F7] px-2.5 py-1.5 font-mono text-[12px] text-[#101828]">
              {hash}
            </code>
            <CopyHash value={hash} />
          </div>
        ) : (
          <p className="mt-1 text-[var(--muted)]">
            Published beside the installer:{" "}
            <a href={WINDOWS_CHECKSUM_URL} className="font-semibold text-[#1A63F4] underline">
              StoreDesk Windows Setup.exe.sha256
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

function Installers({ windowsSha256 }: { windowsSha256: string | null }) {
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
          {it.platform === "windows" ? <WindowsTrust sha256={windowsSha256} /> : null}
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

/** `windowsSha256`: the installer's SHA-256 from the release's `.sha256` file (page.tsx), or null to link to the file. */
export function DownloadClient({ windowsSha256 = null }: { windowsSha256?: string | null }) {
  return (
    <PageFrame>
      <PageHero
        eyebrow="Download"
        title="Install on the back-office PC first"
        lede="The Windows app sets everything up. Add the phone app afterwards, once the store is connected."
        aside={<Installers windowsSha256={windowsSha256} />}
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
