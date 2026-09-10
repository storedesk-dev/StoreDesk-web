"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
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
import { PLANS } from "@/lib/site";

/**
 * How the pieces fit together, in the order an owner meets them.
 *
 * The walkthrough screens mirror the real first-run flow: setup key, then the
 * Commander connection (192.168.31.11 : 443 is the product default), then
 * costs, then the phone. The internet toggle below is the honest answer to
 * "what happens when the line drops" — each row matches the Worker's behaviour.
 */

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[var(--muted)]">{label}</p>
      <p
        className={`mt-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[14.5px] text-[#17202A] ${mono ? "sd-num" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

type Step = { key: string; label: string; icon: ReactNode; title: string; note: string; screen: ReactNode };

const STEPS: Step[] = [
  {
    key: "install",
    label: "Install",
    icon: <KeyRound className="h-4 w-4" />,
    title: "Install on the back-office PC and enter your setup key",
    note: `The key arrives by email when your store is set up. It is good for ${PLANS.setupKeyHours} hours and works once — if it runs out, we send another.`,
    screen: (
      <div className="space-y-4">
        <Field label="Setup key" value="•••• •••• •••• ••••" mono />
        <p className="text-[13px] text-[var(--muted)]">From the email we sent you. Paste it in; nothing else to type.</p>
        <span className="inline-flex rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-4 py-2 text-[14px] font-semibold text-white">
          Activate this PC
        </span>
      </div>
    )
  },
  {
    key: "register",
    label: "Connect",
    icon: <Plug className="h-4 w-4" />,
    title: "Point it at your Commander",
    note: "Use the Commander login you already have. It only needs permission to view — StoreDesk never writes to the register.",
    screen: (
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_88px] gap-3">
          <Field label="Commander address" value="192.168.31.11" mono />
          <Field label="Port" value="443" mono />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username" value="Your Commander login" />
          <Field label="Password" value="••••••••" mono />
        </div>
        <div className="rounded-xl bg-[#00A87B]/10 px-3 py-2.5">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[#00875F]">
            <Check className="h-4 w-4" /> Connected — importing the price book
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#00A87B]/15">
            <motion.div
              className="h-full rounded-full bg-[#00A87B]"
              initial={{ width: "8%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 2.4, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.8 }}
            />
          </div>
        </div>
      </div>
    )
  },
  {
    key: "costs",
    label: "Add costs",
    icon: <Tags className="h-4 w-4" />,
    title: "Add what you pay your suppliers",
    note: "Enter by the case or the pack. StoreDesk works out the cost of one, so suppliers compare fairly.",
    screen: (
      <div className="space-y-3">
        <Field label="Item" value="Cola, 20 oz bottle" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Supplier" value="Peach State Wholesale" />
          <Field label="Case of" value="24" mono />
        </div>
        <Field label="Case cost" value="$27.36" mono />
        <p className="rounded-xl bg-[#1A63F4]/[0.07] px-3 py-2.5 text-[14px] text-[#17202A]">
          <span className="sd-num font-semibold">$1.14</span> each · <span className="sd-num font-semibold">54%</span>{" "}
          margin at the register price of <span className="sd-num">$2.49</span>
        </p>
      </div>
    )
  },
  {
    key: "floor",
    label: "On the floor",
    icon: <ScanLine className="h-4 w-4" />,
    title: "Take it to the floor",
    note: "Staff sign in with their own account, and you choose which screens each person can open.",
    screen: (
      <div className="mx-auto max-w-[250px] rounded-[26px] border-[5px] border-[#17202A] bg-white p-3.5 shadow-lg">
        <div className="flex h-24 items-center justify-center rounded-2xl bg-[#17202A]">
          <motion.div
            className="h-0.5 w-3/4 rounded-full bg-[#28C88B] shadow-[0_0_12px_#28C88B]"
            animate={{ y: [-26, 26, -26] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <p className="mt-3 text-[14px] font-semibold">Cola, 20 oz bottle</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          {[
            ["Price", "$2.49"],
            ["Cost", "$1.14"],
            ["Margin", "54%"]
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-[#F5F8FF] py-1.5">
              <p className="text-[10.5px] text-[var(--muted)]">{k}</p>
              <p className="sd-num text-[13px] font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }
];

function SetupWalkthrough() {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const step = STEPS[index];

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/85 shadow-[0_30px_80px_-30px_rgba(26,99,244,0.45)] backdrop-blur-xl">
      <div role="tablist" aria-label="Setup steps" className="grid grid-cols-4 gap-1 border-b border-[var(--border)] bg-gradient-to-r from-[#F5F8FF] to-[#F0FBF6] p-1.5">
        {STEPS.map((s, i) => {
          const on = i === index;
          return (
            <button
              key={s.key}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setIndex(i)}
              className={`relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[12.5px] font-semibold transition-colors ${
                on ? "text-white" : i < index ? "text-[#00875F]" : "text-[var(--muted)] hover:text-[#1A63F4]"
              }`}
            >
              {on ? (
                <motion.span
                  layoutId="setup-step"
                  className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#1A63F4] to-[#00A87B]"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
                />
              ) : null}
              <span className="relative flex items-center gap-1">
                {i < index ? <Check className="h-4 w-4" /> : s.icon}
                <span className="sd-num">{i + 1}</span>
              </span>
              <span className="relative hidden sm:block">{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-5 md:p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.key}
            initial={{ x: reduceMotion ? 0 : 16, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reduceMotion ? 0 : -16, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
          >
            <h2 className="text-[20px] font-bold tracking-tight">{step.title}</h2>
            <div className="mt-4 min-h-[232px] rounded-2xl bg-[#F7F9FC] p-4">{step.screen}</div>
            <p className="mt-4 border-l-2 border-[#00A87B]/50 pl-3 text-[14.5px] leading-relaxed text-[var(--muted)]">
              {step.note}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[14px] font-semibold text-[#17202A] disabled:opacity-35"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <span className="sd-num text-[13px] text-[var(--muted)]">
            Step {index + 1} of {STEPS.length}
          </span>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(STEPS.length - 1, i + 1))}
            disabled={index === STEPS.length - 1}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#17202A] px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-35"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
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
    offline: "Carries on — it never used the internet",
    offlineState: "up"
  },
  {
    icon: <Monitor className="h-5 w-5" />,
    name: "Desktop app",
    where: "store",
    online: "Price book, costs, reports, sales tax",
    offline: "Works as normal — it runs on the same PC",
    offlineState: "up"
  },
  {
    icon: <UserCheck className="h-5 w-5" />,
    name: "Staff sign-in",
    where: "store",
    online: "Signs in and stays signed in for a shift",
    offline: `Anyone already signed in keeps going for ${PLANS.offlineSessionHours} hours`,
    offlineState: "limited"
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    name: "Phone app away from the store",
    where: "outside",
    online: "Check prices and takings from anywhere",
    offline: "Back as soon as the line is",
    offlineState: "down"
  },
  {
    icon: <FileSpreadsheet className="h-5 w-5" />,
    name: "Google Sheet",
    where: "outside",
    online: "Daily sales written on schedule",
    offline: "Catches up on its own afterwards",
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
    role: "We look after licensing and which PCs are connected. That is all it holds — your sales figures never leave the store."
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
        lede="Four steps on hardware you already own — nothing to rack, nothing to rewire at the till. Click through them to see what each screen asks for."
        aside={<SetupWalkthrough />}
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
