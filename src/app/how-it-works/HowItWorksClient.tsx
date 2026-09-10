"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Laptop, Monitor, Server, Smartphone } from "lucide-react";
import { MarketingShell } from "@/components/MarketingShell";
import { PLANS } from "@/lib/site";

/**
 * How the pieces fit together, in the order an owner meets them.
 *
 * Deliberately not an architecture diagram. The reader is a store owner
 * deciding whether this is worth an afternoon, not an engineer reviewing a
 * design. The names used are the ones they will see on screen.
 */

const STEPS = [
  {
    n: "01",
    title: "Install it on the back-office PC",
    body: "The same computer you already use for paperwork. StoreDesk installs like any other Windows program and runs quietly in the background.",
    note: `You will get a setup key by email. It is good for ${PLANS.setupKeyHours} hours and can only be used once — if it expires, we send another.`
  },
  {
    n: "02",
    title: "Point it at your register",
    body: "Enter the Commander's address on your store network, plus the username and password you already use for it. StoreDesk pulls in the whole PLU list — usually under a minute, even for ten thousand items.",
    note: "The account only needs permission to view PLUs. StoreDesk never writes back to the register."
  },
  {
    n: "03",
    title: "Add what you pay",
    body: "Enter your supplier costs against the items you buy from them. This is the part the register does not know, and it is what turns a price list into a margin report.",
    note: "Enter by case or by pack — StoreDesk works out the per-unit cost so suppliers are actually comparable."
  },
  {
    n: "04",
    title: "Take it to the floor",
    body: "Sign in on your phone and scan a shelf tag. You see the price, the cost and the margin standing right in front of the item.",
    note: "Staff sign in with their own account. You decide which screens each person can open."
  }
];

const PIECES = [
  {
    icon: <Server className="h-5 w-5" />,
    name: "The part on your PC",
    role: "Holds your catalogue, prices and sales history, and does the talking to the register. Everything else is a window onto this."
  },
  {
    icon: <Monitor className="h-5 w-5" />,
    name: "The desktop app",
    role: "Where you run the store: price book, cost comparison, sales reports, sales tax. Talks to the PC it is installed on, so it is quick and unaffected by the internet."
  },
  {
    icon: <Smartphone className="h-5 w-5" />,
    name: "The phone app",
    role: "For the shop floor. Scan, search, check a price, look at today's takings. Connects back to your own PC over a secure link."
  },
  {
    icon: <Laptop className="h-5 w-5" />,
    name: "Your account",
    role: "We look after licensing and who is allowed in. That is all it holds — your sales figures never leave the store."
  }
];

export function HowItWorksClient() {
  const reduceMotion = useReducedMotion();

  return (
    <MarketingShell
      eyebrow="How it works"
      title="An afternoon to set up, then it stays out of your way"
      lede="Four steps, on hardware you already own. Nothing to rack, nothing to rewire at the till."
    >
      <ol className="relative space-y-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)]">
        {STEPS.map((step, index) => (
          <motion.li
            key={step.n}
            initial={{ y: reduceMotion ? 0 : 10 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{
              duration: reduceMotion ? 0 : 0.4,
              delay: reduceMotion ? 0 : index * 0.06,
              ease: [0.22, 1, 0.36, 1]
            }}
            className="grid gap-5 bg-white p-7 md:grid-cols-[72px_1fr] md:p-9"
          >
            <span className="font-mono text-[13px] font-semibold text-[#1A63F4]">{step.n}</span>
            <div>
              <h2 className="text-[19px] font-semibold tracking-tight">{step.title}</h2>
              <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-[var(--foreground)]">
                {step.body}
              </p>
              <p className="mt-3 max-w-2xl border-l-2 border-[#00A87B]/40 pl-3.5 text-[13.5px] leading-relaxed text-[var(--muted)]">
                {step.note}
              </p>
            </div>
          </motion.li>
        ))}
      </ol>

      <section className="mt-16">
        <h2 className="text-[22px] font-semibold tracking-tight">The four pieces</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          You will meet all of these during setup. Only the first one has to be running for
          the store to work.
        </p>
        <div className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
          {PIECES.map((piece) => (
            <div key={piece.name} className="bg-white p-7">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00A87B]/10 text-[#00875F]">
                {piece.icon}
              </span>
              <h3 className="mt-4 text-[16px] font-semibold tracking-tight">{piece.name}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">{piece.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-2xl border border-[var(--border)] bg-[#FBFCFD] p-8 md:p-10">
        <h2 className="text-[20px] font-semibold tracking-tight">
          What happens if the internet goes out
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          The desktop app and the register are both on your store network, so they carry on
          exactly as before. Anyone already signed in stays signed in for{" "}
          {PLANS.offlineSessionHours} hours. What you lose until the line comes back is the
          phone app from outside the store, and the overnight write to your Google Sheet —
          both of which catch up on their own.
        </p>
      </section>
    </MarketingShell>
  );
}
