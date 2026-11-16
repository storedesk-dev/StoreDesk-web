import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  Clock,
  Download,
  HardDrive,
  KeyRound,
  Mail,
  Monitor,
  MoonStar,
  Plug,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Ticket,
  UserCog,
  Wifi,
  type LucideIcon
} from "lucide-react";
import { AppleIcon } from "@/components/BrandIcons";
import { Packages } from "@/components/Packages";
import { PageFrame, PageHero, primaryButton, secondaryButton } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";
import { fetchLatestRelease, formatReleaseDate } from "@/lib/release";
import { DOCS, contactMailto } from "@/lib/site";
import { CopyHash, Installers } from "./DownloadClient";

export const metadata = pageMetadata({
  title: "Download StoreDesk and set it up, step by step",
  description:
    "StoreDesk Desktop and Service for Windows, and StoreDesk Mobile for Android. Install on the back-office PC, activate with your setup key, connect the Verifone Commander, then add the phones.",
  path: "/download",
  absoluteTitle: true
});

/** Re-read hourly, with the release itself (lib/release.ts caches the fetch for an hour). */
export const revalidate = 3600;

/** What to have in hand before the first step. */
const READY: Array<{ icon: LucideIcon; title: string; body: string; action?: { href: string; label: string } }> = [
  {
    icon: KeyRound,
    title: "Your setup key",
    body: "We email it when we set up your store. It starts with set_, works once and expires 24 hours after we send it, so ask for it close to install day.",
    action: { href: contactMailto({ subject: "StoreDesk setup key" }), label: "Ask for a setup key" }
  },
  {
    icon: Monitor,
    title: "The back-office PC",
    body: "64-bit Windows 10 or 11, an administrator account and 1 GB free on C:. The PC in the office, not a till, online and set never to sleep."
  },
  {
    icon: Wifi,
    title: "The register on the same network",
    body: "The PC must reach your Verifone Commander over the store network. Have the Commander's address, user and password."
  },
  {
    icon: UserCog,
    title: "Your StoreDesk sign-in",
    body: "We email the store's admin an invitation. Set your password from it before you start: you sign in with it on the PC, and later on the phone."
  }
];

/** The setup, end to end, in the order it happens. Each step matches the user guide's page for it. */
const STEPS: Array<{
  icon: LucideIcon;
  title: string;
  time: string;
  body: string;
  points: string[];
  guide?: { href: string; label: string };
  action?: { href: string; label: string };
}> = [
  {
    icon: Mail,
    title: "We set up your store",
    time: "About a day",
    body: "Tell us about the store. We create it, set its licence and email you a setup key for the back-office PC.",
    points: ["Store name, address and register model", "Who should be the admin", "The setup key arrives by email"],
    action: { href: "/contact", label: "Ask about your store" }
  },
  {
    icon: Download,
    title: "Install StoreDesk on the back-office PC",
    time: "5 minutes",
    body: "One installer puts StoreDesk Desktop and StoreDesk Service on the PC. The service keeps your data and talks to the register.",
    points: [
      "Double-click the StoreDesk Setup file you downloaded",
      "Windows says Unknown publisher: More info, then Run anyway",
      "Click Yes, Next, wait, then Finish with Run StoreDesk ticked"
    ],
    guide: { href: DOCS.install, label: "Install StoreDesk on the store PC" }
  },
  {
    icon: KeyRound,
    title: "Activate the store",
    time: "5 minutes",
    body: "StoreDesk checks the PC first, then asks for the setup key and ties this PC to your store.",
    points: [
      "Fix what the checks show, for example set sleep to Never",
      "Paste the setup key and agree to the licence terms",
      "Click Activate, then sign in with your StoreDesk email and password"
    ],
    guide: { href: DOCS.activate, label: "Activate your store" }
  },
  {
    icon: Plug,
    title: "Connect the Verifone Commander",
    time: "10 to 20 minutes",
    body: "Enter the register's address and login, test it, and let StoreDesk read the price book for the first time.",
    points: ["Register address, user and password", "Test connection, then Save and continue", "Start first sync and wait for the store to say it is connected"],
    guide: { href: DOCS.connectRegister, label: "Connect the register" }
  },
  {
    icon: UserCog,
    title: "Choose what each role can open",
    time: "5 minutes",
    body: "On the store PC, decide which desktop and phone pages each role sees. Cashiers, managers and owners see only their own.",
    points: ["Settings, then the Users tab", "Pick a role, then Desktop or Phone", "Switch pages on or off and Save"],
    guide: { href: DOCS.topic("page.userManagement"), label: "Users and roles" }
  },
  {
    icon: Smartphone,
    title: "Put StoreDesk Mobile on the phones",
    time: "2 minutes a phone",
    body: "Turn on remote access on the store PC first, or phones say No remote access yet. Then each person installs from Google Play and signs in.",
    points: [
      "Give each person your org tag (ask us if you don't have it)",
      "They set a password from their invitation email",
      "Org tag, Continue, choose the store, then email and password"
    ],
    guide: { href: DOCS.mobileSetup, label: "Set up the phone app" }
  }
];

/** What happens on its own once StoreDesk is installed. Facts from the user guide's Install and updates page. */
const AFTER: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: MoonStar,
    title: "Updates overnight",
    body: "StoreDesk checks every few hours and installs between 2 and 5 in the morning, store PC time. If an update does not install, run the latest Setup from this page: it keeps your data."
  },
  {
    icon: HardDrive,
    title: "Your data stays on the PC",
    body: "The database, activation and backups stay on the store PC, readable only by the PC's administrators. Before an update changes the database, StoreDesk keeps a copy."
  },
  {
    icon: RefreshCw,
    title: "Reinstall without starting over",
    body: "Running a newer Setup updates in place. Uninstalling keeps the store's data unless you tick Remove store data."
  }
];

/**
 * The download page: the files first, then the whole setup in the order it happens, so an owner can
 * go from this page to a connected store and phones without asking. The version, size and SHA-256
 * come from the release the downloads site is serving, read on the server.
 */
export default async function DownloadPage() {
  const release = await fetchLatestRelease();
  const published = release ? formatReleaseDate(release.releaseDate) : null;
  const file = release?.windows ?? null;
  const hash = file?.sha256.toUpperCase() ?? null;

  return (
    <PageFrame>
      <PageHero
        eyebrow="Download"
        title={
          <>
            Get StoreDesk <em className="sd-grad">running in your store</em>
          </>
        }
        lede="Install on the back-office PC, activate it with the setup key we email you, and connect the register. Then add the phones. About an hour at the store, once you have your key."
        aside={<Installers release={release} />}
        actions={
          <>
            <a href="#setup" className={primaryButton}>
              See the setup steps
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
            <a href={DOCS.install} className={secondaryButton}>
              <BookOpen className="h-4 w-4" aria-hidden />
              Open the guide
            </a>
          </>
        }
      >
        {release ? (
          <p className="sd-num mt-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-[rgba(14,67,216,0.12)] bg-white/90 px-4 py-2 text-[15px] shadow-[var(--shadow-card)]">
            <span className="h-2 w-2 rounded-full bg-[var(--green)]" aria-hidden />
            <span className="font-bold text-[var(--ink)]">Version {release.version}</span>
            {release.channel === "beta" ? <span className="text-[var(--muted)]">beta</span> : null}
            {published ? <span className="text-[var(--muted)]">· {published}</span> : null}
            <a href={release.notesUrl} className="sd-link">
              What&rsquo;s new
            </a>
          </p>
        ) : null}
        <ul className="mt-6 space-y-2 text-[16px]">
          <li className="flex flex-wrap items-center gap-x-2">
            <Smartphone className="h-4 w-4 text-[var(--blue)]" aria-hidden />
            <span className="font-bold">Staff getting the phone app?</span>
            <span className="text-[var(--muted)]">Android: Google Play, below. iPhone: coming soon. Your manager gives you the org tag and sign-in.</span>
          </li>
          <li className="flex flex-wrap items-center gap-x-2">
            <Ticket className="h-4 w-4 text-[var(--blue)]" aria-hidden />
            <span className="font-bold">Lottery only?</span>
            <a href="#lottery-only" className="sd-link">
              Skip the back-office steps
            </a>
          </li>
        </ul>
      </PageHero>

      {/* Packages: what a store can buy. */}
      <section id="packages" aria-labelledby="packages-heading" className="sd-band-green border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <p className="sd-eyebrow">Packages</p>
          <h2 id="packages-heading" className="sd-h2 mt-3 max-w-3xl">
            Which <em className="sd-grad">package</em> are you installing?
          </h2>
          <p className="sd-lede mt-4">The steps below are for Back office. Lottery on its own needs only the lottery counter PC: we send you its installer and a sign-in.</p>
          <Packages className="mt-10" />
        </div>
      </section>

      {/* Have these ready */}
      <section aria-labelledby="ready-heading" className="sd-band-blue border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <p className="sd-eyebrow">Before you start</p>
          <h2 id="ready-heading" className="sd-h2 mt-3 max-w-3xl">
            Have these <em className="sd-grad">ready</em>
          </h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {READY.map((item) => (
              <li key={item.title} className="sd-card flex flex-col p-6">
                <span className="sd-icon-tile">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-[19px] font-extrabold tracking-[-0.01em]">{item.title}</h3>
                <p className="mt-2 flex-1 text-[16px] leading-relaxed text-[var(--muted)]">{item.body}</p>
                {item.action ? (
                  <a href={item.action.href} className="sd-link mt-4 inline-flex min-h-11 items-center gap-1.5">
                    {item.action.label}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Setup, end to end */}
      <section id="setup" aria-labelledby="setup-heading" className="sd-band-green border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div>
              <div className="lg:sticky lg:top-28">
                <p className="sd-eyebrow">Setup, end to end</p>
                <h2 id="setup-heading" className="sd-h2 mt-3">
                  From download to a <em className="sd-grad">connected store</em>
                </h2>
                <p className="sd-lede mt-4">
                  Six steps, in order. Each one links to its page in the user guide, with every screen and what to do if
                  something goes wrong.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-[15px] font-semibold shadow-[var(--shadow-card)]">
                  <Clock className="h-4 w-4 text-[var(--blue)]" aria-hidden />
                  About an hour at the store, after we send the key
                </div>
              </div>
            </div>

            <ol className="relative space-y-5">
              {/* The line that joins the step icons. */}
              <span
                aria-hidden
                className="absolute bottom-6 left-[27px] top-6 w-[2px] rounded-full bg-gradient-to-b from-[#1a63f4] via-[#0f86c4] to-[#00a87b] opacity-40"
              />
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative flex gap-4 sm:gap-5">
                  <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1a63f4] to-[#00875f] text-white shadow-[var(--shadow-brand)]">
                    <step.icon className="h-6 w-6" aria-hidden />
                  </span>
                  <div className="sd-card sd-card-link min-w-0 flex-1 p-5 sm:p-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-[var(--blue)]">Step {index + 1}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--green-tint)] px-2.5 py-0.5 text-[13px] font-bold text-[var(--green-ink)]">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                        {step.time}
                      </span>
                    </div>
                    <h3 className="sd-h3 mt-2">{step.title}</h3>
                    <p className="mt-2 text-[16.5px] leading-relaxed text-[var(--muted)]">{step.body}</p>
                    <ul className="mt-4 space-y-2">
                      {step.points.map((point) => (
                        <li key={point} className="flex gap-2.5 text-[16px] leading-snug">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--green)]" aria-hidden />
                          {point}
                        </li>
                      ))}
                    </ul>
                    {step.guide || step.action ? (
                      <div className="mt-4 flex flex-wrap gap-x-5">
                        {step.guide ? (
                          <a href={step.guide.href} className="sd-link inline-flex min-h-11 items-center gap-1.5">
                            <BookOpen className="h-4 w-4" aria-hidden />
                            {step.guide.label}
                          </a>
                        ) : null}
                        {step.action ? (
                          <Link href={step.action.href} className="sd-link inline-flex min-h-11 items-center gap-1.5">
                            {step.action.label}
                            <ArrowRight className="h-4 w-4" aria-hidden />
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Windows SmartScreen */}
      <section aria-labelledby="warn-heading" className="sd-band-blue border-b border-[var(--line)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="sd-eyebrow">First run</p>
            <h2 id="warn-heading" className="sd-h2 mt-3">
              Windows will <em className="sd-grad">warn you once</em>
            </h2>
            <p className="sd-lede mt-4">
              The installer is not signed with a paid certificate yet, so Windows says it protected your PC. Choose{" "}
              <strong className="text-[var(--ink)]">More info</strong>, then <strong className="text-[var(--ink)]">Run anyway</strong>.
            </p>
            <p className="mt-3 text-[16px] leading-relaxed text-[var(--muted)]">
              No Run anyway button, or a message that Smart App Control blocked it? Contact us. Do not change Windows security settings to
              get past it.
            </p>
            {hash ? (
              <details className="sd-card mt-6 px-5 py-3">
                <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-[16px] font-bold">
                  <ShieldCheck className="h-4 w-4 text-[var(--green)]" aria-hidden />
                  Check the file you downloaded
                </summary>
                <div className="mt-2 space-y-3 pb-2 text-[15px]">
                  <p className="text-[var(--muted)]">
                    In PowerShell, where you saved it, run{" "}
                    <code className="font-mono">Get-FileHash .\{file?.name}</code> and compare the value with this one. If they differ, do
                    not run the file.
                  </p>
                  <div className="flex items-start gap-2">
                    <code className="sd-num min-w-0 flex-1 break-all rounded-[var(--radius-sm)] bg-[var(--wash)] px-3 py-2 font-mono text-[13px]">
                      {hash}
                    </code>
                    <CopyHash value={hash} />
                  </div>
                </div>
              </details>
            ) : null}
          </div>

          {/* A drawing of the two clicks, in Windows' own blue. Decorative: the text beside it says it. */}
          <div aria-hidden className="sd-glow">
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-white/40 bg-[#0b5cad] text-white shadow-[0_30px_60px_-24px_rgba(11,31,77,0.55)]">
              <div className="px-7 pb-6 pt-7">
                <p className="text-[24px] font-semibold leading-tight">Windows protected your PC</p>
                <p className="mt-3 text-[15px] leading-relaxed text-white/85">
                  Microsoft Defender SmartScreen prevented an unrecognised app from starting.
                </p>
                <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-white/15 px-2 py-1 text-[15px] font-semibold underline underline-offset-4">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[13px] font-extrabold text-[#0b5cad]">1</span>
                  More info
                </p>
              </div>
              <div className="flex justify-end gap-3 bg-[#094f96] px-7 py-4">
                <span className="inline-flex items-center gap-2 rounded-md border-2 border-white bg-white/10 px-4 py-2 text-[15px] font-semibold">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[13px] font-extrabold text-[#0b5cad]">2</span>
                  Run anyway
                </span>
                <span className="rounded-md bg-white/10 px-4 py-2 text-[15px] font-semibold text-white/70">Don&rsquo;t run</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* After setup */}
      <section aria-labelledby="after-heading" className="sd-band-green border-b border-[var(--line)]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <p className="sd-eyebrow">After setup</p>
          <h2 id="after-heading" className="sd-h2 mt-3 max-w-3xl">
            It <em className="sd-grad">looks after itself</em>
          </h2>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {AFTER.map((item) => (
              <li key={item.title} className="sd-card p-6">
                <span className="sd-icon-tile">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-[19px] font-extrabold tracking-[-0.01em]">{item.title}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-[var(--muted)]">{item.body}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-[17px]">
            <a href={DOCS.updates} className="sd-link">
              Install and updates, in the guide
            </a>
          </p>
        </div>
      </section>

      {/* Other downloads and help */}
      <section aria-labelledby="more-heading" className="sd-band-mix">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <p className="sd-eyebrow">More</p>
          <h2 id="more-heading" className="sd-h2 mt-3 max-w-3xl">
            Other downloads <em className="sd-grad">and help</em>
          </h2>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            <li id="lottery-only" className="sd-card flex scroll-mt-28 flex-col p-6">
              <span className="sd-icon-tile">
                <Ticket className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-[19px] font-extrabold">StoreDesk Lottery, with or without the back office</h3>
              <p className="mt-2 flex-1 text-[16px] leading-relaxed text-[var(--muted)]">
                No setup key and no register needed. We set up your store and send the installer for the counter PC; you sign in with
                your StoreDesk email and password. The first sign-in needs the internet.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5">
                <a href={contactMailto({ subject: "StoreDesk Lottery installer" })} className="sd-link inline-flex min-h-11 items-center">
                  Ask us for it
                </a>
                <Link href="/product/lottery" className="sd-link inline-flex min-h-11 items-center">
                  What it does
                </Link>
              </div>
            </li>
            <li className="sd-card flex flex-col p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#111] text-white shadow-[var(--shadow-card)]">
                <AppleIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-[19px] font-extrabold">iPhone, Mac and Linux</h3>
              <p className="mt-2 flex-1 text-[16px] leading-relaxed text-[var(--muted)]">
                StoreDesk Mobile for iPhone is coming soon on the App Store; until then, staff use the Android app. StoreDesk Desktop, Service and Lottery run on Windows only.
              </p>
            </li>
            <li className="sd-card flex flex-col p-6">
              <span className="sd-icon-tile">
                <CircleHelp className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-[19px] font-extrabold">If something will not start</h3>
              <p className="mt-2 flex-1 text-[16px] leading-relaxed text-[var(--muted)]">
                The service, the register connection and the messages Setup can show, each with what to do.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5">
                <a href={DOCS.troubleshooting} className="sd-link inline-flex min-h-11 items-center">
                  Troubleshooting
                </a>
                <a href={DOCS.releaseNotes} className="sd-link inline-flex min-h-11 items-center">
                  Release notes
                </a>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </PageFrame>
  );
}
