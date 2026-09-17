"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, Check, ChevronRight, Copy, KeyRound, Monitor, ShieldAlert, Smartphone } from "lucide-react";
import { GooglePlayIcon, WindowsIcon } from "@/components/BrandIcons";
import { PageFrame, PageHero, SectionHead } from "@/components/PageHero";
import { DOCS, PLAY_STORE_URL, contactMailto } from "@/lib/site";
import { useRelease } from "@/components/ReleaseContext";
import { formatReleaseDate, formatSize, type LatestRelease, type ReleaseFile } from "@/lib/release";

/**
 * The download page, in the order the questions come up: which file, what to know before you run it,
 * what Windows will say, and where the help is.
 *
 * Everything about the release is read once, in the layout, from the site the files actually live on
 * (components/ReleaseContext). The version appears in one place rather than in the hero and again on
 * each card, and the unsigned-installer explanation is one note under both cards rather than a fourth
 * paragraph inside the Windows one.
 */

type Platform = "windows" | "android";

const INSTALLERS: Array<{ platform: Platform; name: string; requirement: string; body: string; cta: string; footnote: string }> = [
  {
    platform: "windows",
    name: "StoreDesk for Windows",
    requirement: "Windows 10 or later",
    body: "The back office. Holds your catalogue and sales history, and talks to the register.",
    cta: "Download for Windows",
    footnote: "Windows asks once for permission to install the background service."
  },
  {
    platform: "android",
    name: "StoreDesk for Android",
    requirement: "Android 5.0 or later",
    body: "The shop floor. Scan a shelf tag to see the price, the cost and the margin.",
    cta: "Get it on Google Play",
    footnote: "Installs and updates itself through Play, like any other app on the phone."
  }
];

function PlatformBadge({ platform }: { platform: Platform }) {
  return platform === "windows" ? (
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0078D4] text-white shadow-[0_8px_20px_-8px_rgba(0,120,212,0.7)]">
      <WindowsIcon className="h-5 w-5" />
    </span>
  ) : (
    // The Play mark, not the Android robot: the app is listed, and this is what a store recognises.
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-white shadow-[0_8px_20px_-10px_rgba(23,32,42,0.35)]">
      <GooglePlayIcon className="h-5 w-5" />
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

/** Version, date and channel, once, with the notes for exactly that version. */
function ReleaseLine({ release }: { release: LatestRelease }) {
  const published = formatReleaseDate(release.releaseDate);
  return (
    <div className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-2.5">
      <span className="sd-num inline-flex items-center gap-2 text-[15px] font-bold text-[#17202A]">
        <span className="h-2 w-2 rounded-full bg-[#00A87B]" aria-hidden />
        Version {release.version}
      </span>
      {release.channel === "beta" ? (
        <span className="rounded-full bg-[#B54708]/10 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-wide text-[#B54708]">Beta</span>
      ) : null}
      {published ? <span className="sd-num text-[14px] text-[var(--muted)]">{published}</span> : null}
      <a href={release.notesUrl} className="text-[14px] font-semibold text-[#1A63F4] hover:underline">
        What&rsquo;s new
      </a>
    </div>
  );
}

function Installers({ release }: { release: LatestRelease | null }) {
  // Detected after mount so the server HTML and first client render agree.
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
        return (
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
                  <h2 className="text-[19px] font-bold tracking-tight">{it.name}</h2>
                  {detected === it.platform ? (
                    <span className="rounded-full bg-[#00A87B]/12 px-2.5 py-0.5 text-[12px] font-semibold text-[#00875F]">For this device</span>
                  ) : null}
                </div>
                <p className="sd-num mt-0.5 text-[13px] text-[var(--muted)]">
                  {[
                    it.requirement,
                    it.platform === "android" ? "Google Play" : file && formatSize(file.size)
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-2 text-[15.5px] leading-relaxed text-[#344054]">{it.body}</p>
              </div>
            </div>
            {linkFor(it.platform, file) ? (
              <a
                href={linkFor(it.platform, file) as string}
                className={`mt-5 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15.5px] font-semibold text-white transition-[filter] hover:brightness-110 ${
                  it.platform === "windows" ? "bg-[#0078D4]" : "bg-[#00875F]"
                }`}
              >
                {it.platform === "windows" ? (
                  <ArrowDownToLine className="h-4 w-4" aria-hidden />
                ) : (
                  <GooglePlayIcon className="h-4 w-4" />
                )}
                {it.cta}
              </a>
            ) : (
              // The bucket could not be read, or this release has no file for this platform. Never show a
              // button that goes nowhere.
              <p className="mt-5 rounded-full bg-[#F2F4F7] px-5 py-3 text-center text-[15px] font-semibold text-[#475467]">
                Not available right now.{" "}
                <a href={contactMailto({ subject: "StoreDesk download" })} className="text-[#1A63F4] underline">
                  Ask us for it
                </a>
              </p>
            )}
            <p className="mt-2.5 text-center text-[13px] text-[var(--muted)]">{it.footnote}</p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The unsigned installer, explained once for both downloads.
 *
 * The SmartScreen warning is what a store actually hits, so it leads. The SHA-256 sits behind a
 * disclosure: it is served from the same domain as the installer, so on its own it proves little, and
 * it earns its place only for the person comparing it against the value in the release notes.
 */
function TrustNote({ file }: { file: ReleaseFile | null }) {
  const [showHash, setShowHash] = useState(false);
  const hash = file?.sha256.toUpperCase() ?? null;
  return (
    <div className="rounded-[28px] border border-[#B54708]/25 bg-[#FFFCF5] p-7">
      <div className="flex gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#B54708]/10 text-[#B54708]">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[19px] font-bold tracking-tight">Windows will warn you the first time</h2>
          <p className="mt-1.5 max-w-2xl text-[16px] leading-relaxed text-[var(--muted)]">
            StoreDesk is not signed with a paid certificate yet, so Windows says it protected your PC. Choose{" "}
            <span className="font-semibold text-[#344054]">More info</span>, then{" "}
            <span className="font-semibold text-[#344054]">Run anyway</span>.
          </p>
          {hash ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowHash((open) => !open)}
                aria-expanded={showHash}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--muted)] hover:text-[#1A63F4]"
              >
                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showHash ? "rotate-90" : ""}`} aria-hidden />
                Verify the file you downloaded
              </button>
              {showHash ? (
                <div className="mt-3 space-y-2 text-[13px]">
                  <p className="text-[var(--muted)]">
                    Compare this with the SHA-256 in the release notes. In PowerShell, where you saved it:{" "}
                    <code className="font-mono">Get-FileHash .\{file?.name}</code>
                  </p>
                  <div className="flex items-start gap-2">
                    <code className="sd-num min-w-0 flex-1 break-all rounded-lg bg-white px-2.5 py-1.5 font-mono text-[12px] text-[#101828]">{hash}</code>
                    <CopyHash value={hash} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const BEFORE = [
  {
    icon: <KeyRound className="h-5 w-5" />,
    title: "A setup key",
    body: `We email it when your store is set up on our side. Keep it: it sets up your store's PC again, or a new one.`,
    action: { href: contactMailto({ subject: "StoreDesk setup key" }), label: "Request a key" }
  },
  {
    icon: <Monitor className="h-5 w-5" />,
    title: "The back-office PC",
    body: "The Windows PC that can reach your register over the store network. Not a till.",
    action: null
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    title: "Phones last",
    body: "Install the Android app once the store PC is connected, and sign staff in against your store.",
    action: null
  }
];

const HELP = [
  { href: DOCS.install, title: "Setup guide", body: "Every step, with screenshots of each screen." },
  { href: DOCS.troubleshooting, title: "Troubleshooting", body: "If the service will not start or the register will not answer." },
  { href: DOCS.releaseNotes, title: "What's new", body: "What changed in this version and the ones before it." }
];

/** The release comes from the layout (ReleaseContext); null when downloads.storedesk.net could not be read. */
export function DownloadClient() {
  const release = useRelease();
  return (
    <PageFrame>
      <PageHero
        eyebrow="Download"
        title="Install on the back-office PC first"
        lede="The Windows app sets everything up and keeps your store's data. Add the phone app afterwards, once the store is connected."
        aside={<Installers release={release} />}
      >
        {release ? <ReleaseLine release={release} /> : null}
      </PageHero>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHead eyebrow="Before you install" title="Three things to have ready" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {BEFORE.map((item) => (
            <div key={item.title} className="flex flex-col rounded-[24px] border border-[var(--border)] bg-white p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1A63F4]/10 text-[#1A63F4]">{item.icon}</span>
              <h3 className="mt-4 text-[18px] font-bold tracking-tight">{item.title}</h3>
              <p className="mt-2 flex-1 text-[15.5px] leading-relaxed text-[var(--muted)]">{item.body}</p>
              {item.action ? (
                <a
                  href={item.action.href}
                  className="mt-4 inline-flex w-fit rounded-full bg-[#17202A] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#1A63F4]"
                >
                  {item.action.label}
                </a>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-10">
          <TrustNote file={release?.windows ?? null} />
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {HELP.map((card) => (
            <a
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-[#E4E7EC] bg-white p-5 transition-colors hover:border-[#1A63F4]/40"
            >
              <p className="flex items-center gap-1.5 text-[15.5px] font-bold tracking-tight">
                {card.title}
                <ArrowUpRight className="h-4 w-4 text-[#1A63F4] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </p>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--muted)]">{card.body}</p>
            </a>
          ))}
        </div>

        <p className="mt-8 text-[15px] text-[var(--muted)]">
          There is no iPhone version yet. macOS and Linux can run the desktop app for development, but the background
          service that keeps it running is Windows-only today.
        </p>
      </section>
    </PageFrame>
  );
}
