"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Cloud,
  FileSpreadsheet,
  KeyRound,
  Monitor,
  Plug,
  ScanLine,
  Server,
  Smartphone,
  Tags,
  UserCheck
} from "lucide-react";
import { PageFrame, PageHero, SectionHead, primaryButton } from "@/components/PageHero";
import { DOCS, PLANS } from "@/lib/site";

/**
 * How the pieces fit together, in the order an owner meets them.
 *
 * The walkthrough screens mirror the real first-run flow: setup key, then the
 * Commander connection (192.168.31.11 : 443 is the product default), then
 * costs, then the phone. The internet toggle below is the honest answer to
 * "what happens when the line drops" — each row matches the Worker's behaviour.
 */

type Step = {
  key: string;
  label: string;
  icon: ReactNode;
  title: string;
  /** What the store ends up with — not the keystrokes; those are the guide's job. */
  outcome: string;
  minutes: string;
  href: string;
};

/**
 * The four stages of a first setup, in order.
 *
 * Deliberately not a copy of the screens. The guide already walks each one keystroke by keystroke,
 * with real screenshots (docs.storedesk.net), and a second set of hand-drawn mock fields here would
 * drift from the product the first time a screen changed. So this says what each stage is for and
 * roughly how long it takes, and hands off.
 */
const STEPS: Step[] = [
  {
    key: "install",
    label: "Install",
    icon: <KeyRound className="h-4 w-4" />,
    title: "Install on the back-office PC",
    outcome: `Run the installer, paste the setup key from your email, and this PC is your store's. The key lasts ${PLANS.setupKeyHours} hours and works once.`,
    minutes: "about 10 minutes",
    href: DOCS.install
  },
  {
    key: "register",
    label: "Connect",
    icon: <Plug className="h-4 w-4" />,
    title: "Point it at your Commander",
    outcome:
      "Give it the register's address and your existing Commander login. The price book imports itself: ten thousand items in a few minutes.",
    minutes: "about 15 minutes",
    href: DOCS.connectRegister
  },
  {
    key: "costs",
    label: "Add costs",
    icon: <Tags className="h-4 w-4" />,
    title: "Add what you pay your suppliers",
    outcome:
      "Enter case or pack costs as invoices come in. StoreDesk works out the cost of one, so two suppliers on the same item compare fairly.",
    minutes: "as invoices arrive",
    href: DOCS.topic("page.vendors")
  },
  {
    key: "floor",
    label: "On the floor",
    icon: <ScanLine className="h-4 w-4" />,
    title: "Put it in your staff's hands",
    outcome:
      "Install the phone app, and staff scan a shelf tag to see price, cost and margin. You choose which screens each person can open.",
    minutes: "a few minutes each",
    href: DOCS.mobileSetup
  }
];

/**
 * The four stages, as one glance.
 *
 * This was a carousel that advanced through the four steps one panel at a time. The panels only ever
 * said what the stage was for and then linked to the guide, which is a lot of screen and motion for
 * very little: the guide is where the actual steps live, with screenshots. So the shape of the
 * afternoon is shown all at once, which is the only thing this section is really claiming, and the
 * links go straight to the step a reader wants.
 */
function SetupStages() {
  return (
    <ol className="overflow-hidden rounded-[28px] border border-white/80 bg-white/85 shadow-[0_30px_80px_-30px_rgba(26,99,244,0.45)] backdrop-blur-xl">
      {STEPS.map((step, index) => (
        <li key={step.key} className={index > 0 ? "border-t border-[var(--border)]" : ""}>
          <a href={step.href} className="group flex items-start gap-4 p-5 transition-colors hover:bg-[#F5F8FF]">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1A63F4] to-[#00A87B] text-white">
              {step.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[17px] font-bold tracking-tight">{step.title}</span>
                <span className="sd-num text-[12.5px] text-[var(--muted)]">{step.minutes}</span>
              </span>
              <span className="mt-1 block text-[15px] leading-relaxed text-[var(--muted)]">{step.outcome}</span>
            </span>
            <ArrowRight
              className="mt-2 h-4 w-4 shrink-0 text-[#1A63F4] opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          </a>
        </li>
      ))}
    </ol>
  );
}

type Link_ = {
  icon: ReactNode;
  name: string;
  where: "store" | "outside";
  online: string;
  offline: string;
  offlineState: "up" | "limited" | "down";
};

const LINKS: Link_[] = [
  {
    icon: <Server className="h-5 w-5" />,
    name: "Register ↔ store PC",
    where: "store",
    online: "Reading prices and sales over the store network",
    offline: "Carries on. It never used the internet",
    offlineState: "up"
  },
  {
    icon: <Monitor className="h-5 w-5" />,
    name: "Desktop app",
    where: "store",
    online: "Price book, costs, reports, sales tax",
    offline: "Works as normal. It runs on the same PC",
    offlineState: "up"
  },
  {
    icon: <UserCheck className="h-5 w-5" />,
    name: "Staff sign-in",
    where: "store",
    online: "Signs in and stays signed in for a shift",
    // Passwords are argon2id hashes in the store's own database and are checked there
    // (StoreAuthHandlers + AccessUser), so signing in fresh works with the line down, not just
    // staying signed in. A session then lasts PLANS.offlineSessionHours.
    offline: `Signing in still works. Passwords are checked on the store PC, and a session lasts ${PLANS.offlineSessionHours} hours`,
    offlineState: "up"
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    name: "Phone app",
    where: "outside",
    online: "Check prices and takings from anywhere",
    // Phones reach the store through the tunnel, so they need the line. An admin can turn on local
    // network access (STOREDESK_LAN_ACCESS) and phones on the store's own Wi-Fi keep working; it is
    // off by default, so the honest default answer is "down".
    offline: "Back as soon as the line is, unless an admin has turned on local network access",
    offlineState: "down"
  },
  {
    icon: <FileSpreadsheet className="h-5 w-5" />,
    name: "Google Sheet",
    where: "outside",
    online: "Daily sales written on schedule",
    offline: "Writes the days it missed once the line is back",
    offlineState: "down"
  },
  {
    icon: <Cloud className="h-5 w-5" />,
    name: "Your StoreDesk account",
    where: "outside",
    online: "Licence and connected PCs",
    offline: "Not needed to keep trading",
    offlineState: "limited"
  }
];

const STATE_STYLE = {
  up: { dot: "bg-[#00A87B]", pill: "bg-[#00A87B]/12 text-[#00875F]", label: "Working" },
  limited: { dot: "bg-[#F79009]", pill: "bg-[#F79009]/12 text-[#B54708]", label: "Holding" },
  down: { dot: "bg-[#98A2B3]", pill: "bg-[#98A2B3]/15 text-[#475467]", label: "Paused" }
} as const;

function OutageSimulator() {
  const [offline, setOffline] = useState(false);

  return (
    <div className="mt-10 rounded-[32px] border border-[var(--border)] bg-white p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[16px] font-semibold">
          Internet at the store:{" "}
          <span className={offline ? "text-[#B42318]" : "text-[#00875F]"}>{offline ? "down" : "connected"}</span>
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={offline}
          onClick={() => setOffline((v) => !v)}
          className={`relative inline-flex h-10 w-[184px] items-center rounded-full p-1 text-[14px] font-semibold transition-colors ${
            offline ? "bg-[#17202A]" : "bg-[#E8F0FF]"
          }`}
        >
          <motion.span
            className="absolute top-1 h-8 w-[88px] rounded-full bg-white shadow"
            animate={{ left: offline ? 92 : 4 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          />
          <span className={`relative w-1/2 text-center ${offline ? "text-white/70" : "text-[#17202A]"}`}>Online</span>
          <span className={`relative w-1/2 text-center ${offline ? "text-[#17202A]" : "text-[#475467]"}`}>Line down</span>
        </button>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {(["store", "outside"] as const).map((group) => (
          <div key={group}>
            <p className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
              {group === "store" ? "Inside the store" : "Needs the internet"}
            </p>
            <ul className="mt-3 space-y-2.5">
              {LINKS.filter((l) => l.where === group).map((l) => {
                const state = offline ? l.offlineState : "up";
                const style = STATE_STYLE[state];
                return (
                  <motion.li
                    key={l.name}
                    layout
                    className={`flex items-start gap-3.5 rounded-2xl border p-4 transition-colors ${
                      state === "down" ? "border-dashed border-[#D0D5DD] bg-[#F9FAFB]" : "border-[var(--border)] bg-white"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        state === "down" ? "bg-[#EAECF0] text-[#98A2B3]" : "bg-[#1A63F4]/8 text-[#1A63F4]"
                      }`}
                    >
                      {l.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[15.5px] font-semibold">{l.name}</p>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${style.pill}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                          {style.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--muted)]">
                        {offline ? l.offline : l.online}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const PIECES = [
  {
    icon: <Server className="h-5 w-5" />,
    name: "The service on your PC",
    role: "Holds the catalogue, prices and sales history, and does the talking to the register. Everything else is a window onto it."
  },
  {
    icon: <Monitor className="h-5 w-5" />,
    name: "The desktop app",
    role: "Where you run the store: price book, cost comparison, sales reports, sales tax. Fast, because it talks to the PC it is installed on."
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    name: "The phone app",
    role: "For the shop floor. Scan, search, check a price, look at today’s takings. Connects back to your own PC over a secure link."
  },
  {
    icon: <Cloud className="h-5 w-5" />,
    name: "Your account",
    role: "We look after licensing and which PCs are connected. That is all it holds. Your sales figures never leave the store."
  }
];

export function HowItWorksClient() {
  return (
    <PageFrame>
      <PageHero
        eyebrow="How it works"
        title={
          <>
            An afternoon to set up.{" "}
            <span className="bg-gradient-to-r from-[#1A63F4] to-[#00A87B] bg-clip-text text-transparent">
              Then it stays out of your way.
            </span>
          </>
        }
        lede="Four steps on hardware you already own. Nothing to rack, nothing to rewire at the till. Each one links to the guide, which walks it screen by screen."
        aside={<SetupStages />}
        actions={
          <Link href="/download" className={primaryButton}>
            Start with the installer <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHead
          eyebrow="When the internet goes out"
          title="Flip the switch and see what keeps working"
          lede="The register and the back-office PC talk over your store network, so the parts that run the store do not care whether the line is up."
        />
        <OutageSimulator />
      </section>

      <section className="border-t border-[var(--border)] bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHead
            eyebrow="The pieces"
            title="Four parts, one of them doing the heavy lifting"
            lede="You meet all four during setup. Only the first has to be running for the store to work."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PIECES.map((piece, i) => (
              <div
                key={piece.name}
                className={`rounded-3xl border p-7 ${
                  i === 0 ? "border-[#1A63F4]/30 bg-gradient-to-br from-[#F5F8FF] to-[#F0FBF6]" : "border-[var(--border)] bg-white"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00A87B]/12 text-[#00875F]">
                  {piece.icon}
                </span>
                <h3 className="mt-4 text-[19px] font-bold tracking-tight">{piece.name}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-[var(--muted)]">{piece.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
