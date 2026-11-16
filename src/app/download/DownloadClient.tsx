"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, Check, Copy } from "lucide-react";
import { AppleIcon, GooglePlayIcon, WindowsIcon } from "@/components/BrandIcons";
import { PLAY_STORE_URL, contactMailto } from "@/lib/site";
import { formatSize, type LatestRelease, type ReleaseFile } from "@/lib/release";

/**
 * The two downloads. A client component only so the card for the visitor's own device can say so:
 * the platform is detected after mount, so the server HTML and the first client render agree.
 * Everything about the release comes from the page, which read it on the server.
 */

type Platform = "windows" | "android";

const INSTALLERS: Array<{ platform: Platform; name: string; requirement: string; body: string; cta: string; footnote: string }> = [
  {
    platform: "windows",
    name: "StoreDesk Desktop and Service",
    requirement: "Windows 10 or later",
    body: "One installer for the back-office PC. StoreDesk Service keeps your data and talks to the register; StoreDesk Desktop is where you work.",
    cta: "Download for Windows",
    footnote: "Windows asks once for permission to install StoreDesk Service."
  },
  {
    platform: "android",
    name: "StoreDesk Mobile",
    requirement: "Android 5.0 or later",
    body: "For the shop floor. Scan a shelf tag to see the price, the cost and the margin.",
    cta: "Get it on Google Play",
    footnote: "Installs and updates through Google Play, like any other app."
  }
];

export function Installers({ release }: { release: LatestRelease | null }) {
  const [detected, setDetected] = useState<Platform | null>(null);
  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) setDetected("android");
    else if (/Windows/i.test(ua)) setDetected("windows");
  }, []);

  const fileFor = (platform: Platform) => (platform === "windows" ? release?.windows : release?.android) ?? null;
  /** Windows is a file to download; Android is a Play listing. */
  const linkFor = (platform: Platform, file: ReleaseFile | null) => (platform === "android" ? PLAY_STORE_URL : file?.url ?? null);

  return (
    <div className="space-y-4">
      {INSTALLERS.map((it) => {
        const file = fileFor(it.platform);
        const href = linkFor(it.platform, file);
        const mine = detected === it.platform;
        return (
          <div
            key={it.platform}
            className={`sd-card sd-card-link p-6 ${mine ? "!border-[var(--blue)] ring-2 ring-[var(--blue)]/30" : ""}`}
          >
            <div className="flex items-start gap-4">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] shadow-[var(--shadow-card)] ${
                  it.platform === "windows" ? "bg-[#0078D4] text-white" : "border border-[var(--line)] bg-white"
                }`}
              >
                {it.platform === "windows" ? <WindowsIcon className="h-6 w-6" /> : <GooglePlayIcon className="h-6 w-6" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[20px] font-extrabold">{it.name}</h2>
                  {mine ? (
                    <span className="rounded-full bg-[var(--green-tint)] px-2.5 py-0.5 text-[14px] font-bold text-[var(--green-ink)]">This device</span>
                  ) : null}
                </div>
                <p className="sd-num mt-0.5 text-[15px] text-[var(--muted)]">
                  {[it.requirement, it.platform === "android" ? "Google Play" : file && formatSize(file.size)].filter(Boolean).join(". ")}
                </p>
                <p className="mt-2 text-[16px] leading-relaxed text-[var(--muted)]">{it.body}</p>
              </div>
            </div>
            {href ? (
              <a
                href={href}
                className="sd-btn mt-5 w-full"
              >
                {it.platform === "windows" ? <ArrowDownToLine className="h-4 w-4" aria-hidden /> : <GooglePlayIcon className="h-4 w-4" />}
                {it.cta}
              </a>
            ) : (
              // The downloads site could not be read, or this release has no file for this platform.
              // Never show a button that goes nowhere.
              <p className="mt-5 rounded-2xl bg-[var(--wash)] px-5 py-3 text-center text-[16px] font-semibold">
                Not available right now.{" "}
                <a href={contactMailto({ subject: "StoreDesk download" })} className="sd-link">
                  Ask us for it
                </a>
              </p>
            )}
            <p className="mt-2.5 text-center text-[14px] text-[var(--muted)]">{it.footnote}</p>
          </div>
        );
      })}
      {/* The iPhone app: listed so an iPhone visitor knows it is coming, with nothing to click yet. */}
      <div className="sd-card flex items-center gap-4 p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#111] text-white shadow-[var(--shadow-card)]">
          <AppleIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-extrabold">StoreDesk Mobile for iPhone</h2>
          <p className="text-[15px] text-[var(--muted)]">On the App Store soon. Until then, use the Android app.</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--blue-tint)] px-3 py-1 text-[13px] font-bold text-[var(--blue-ink)]">Coming soon</span>
      </div>
    </div>
  );
}

export function CopyHash({ value }: { value: string }) {
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
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white px-3 text-[14px] font-semibold"
    >
      {copied ? <Check className="h-4 w-4 text-[var(--green-ink)]" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
