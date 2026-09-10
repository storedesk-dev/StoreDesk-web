"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, Cloud, HardDrive } from "lucide-react";
import { PageFrame, PageHero, SectionHead, primaryButton, secondaryButton } from "@/components/PageHero";
import { contactMailto } from "@/lib/site";

/**
 * Why the product exists, and where each kind of data lives.
 *
 * The data map is the page's argument made concrete: a store owner's first
 * question about any back office is "who else can see my numbers". Each entry
 * matches the split in CLAUDE.md — store data on the Worker, licensing on the
 * control plane.
 */

type Entry = { name: string; why: string };

const ON_PC: Entry[] = [
  { name: "Price book and PLUs", why: "Read from your register and kept on the PC. A refresh only rewrites the items that changed." },
  { name: "Supplier costs", why: "The numbers you type in. Nobody outside the store needs them, so they never leave it." },
  { name: "Sales and shift reports", why: "Pulled from the Commander and stored on the PC, with the individual transactions behind them." },
  { name: "Sales tax returns", why: "Worked out on the PC from the same sales data, and saved as a file you file yourself." }
];

const IN_ACCOUNT: Entry[] = [
  { name: "Your organisation and stores", why: "So we know which licence covers which store. Names and addresses, not figures." },
  { name: "Licence and plan", why: "Whether you are on the trial or the standard plan, and when it renews." },
  { name: "Which PCs are connected", why: "Each store PC gets its own credential, so one can be replaced without touching the others." },
  { name: "A log of account changes", why: "Who changed what in the account, and when — useful if more than one person manages it." }
];

function DataMap() {
  const [selected, setSelected] = useState<string>(ON_PC[0].name);
  const reduceMotion = useReducedMotion();
  const entry = [...ON_PC, ...IN_ACCOUNT].find((e) => e.name === selected) ?? ON_PC[0];
  const onPc = ON_PC.some((e) => e.name === entry.name);

  const column = (title: string, icon: ReactNode, entries: Entry[], tint: "blue" | "green") => (
    <div
      className={`rounded-3xl p-4 ${tint === "green" ? "bg-[#00A87B]/[0.07]" : "bg-[#1A63F4]/[0.06]"}`}
    >
      <p className={`flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.1em] ${tint === "green" ? "text-[#00875F]" : "text-[#1A63F4]"}`}>
        {icon}
        {title}
      </p>
      <ul className="mt-3 space-y-1.5">
        {entries.map((e) => {
          const on = e.name === selected;
          return (
            <li key={e.name}>
              <button
                type="button"
                onClick={() => setSelected(e.name)}
                aria-pressed={on}
                className={`w-full rounded-xl px-3 py-2 text-left text-[14.5px] font-semibold transition-colors ${
                  on ? "bg-white text-[#17202A] shadow-sm" : "text-[#344054] hover:bg-white/70"
                }`}
              >
                {e.name}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <div className="rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-[0_30px_80px_-30px_rgba(26,99,244,0.45)] backdrop-blur-xl md:p-5">
      <p className="px-1 text-[15px] font-semibold">Where your numbers live</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {column("On your store PC", <HardDrive className="h-4 w-4" />, ON_PC, "green")}
        {column("In your account", <Cloud className="h-4 w-4" />, IN_ACCOUNT, "blue")}
      </div>
      <div className="mt-3 min-h-[92px] rounded-2xl bg-[#17202A] p-4 text-white">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={entry.name}
            initial={{ y: reduceMotion ? 0 : 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            <p className={`text-[12px] font-bold uppercase tracking-[0.1em] ${onPc ? "text-[#28C88B]" : "text-[#8DB4FF]"}`}>
              {onPc ? "Stays in the store" : "Held by StoreDesk"}
            </p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-white/85">{entry.why}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const BELIEFS = [
  {
    title: "Your data stays in your store",
    body: "Sales figures, margins and supplier prices are the most sensitive numbers a small retailer has. The cloud side of StoreDesk knows your store exists and that your licence is paid. It does not know what you sold today."
  },
  {
    title: "It has to work when the line is down",
    body: "Rural stores lose internet. A back office that turns into a blank screen when that happens is not a back office, so everything that matters runs on the PC in the room."
  },
  {
    title: "The register is the source of truth",
    body: "StoreDesk reads from your Commander and never writes to it. Nothing we do can put a wrong price on a till. If StoreDesk vanished tomorrow, the store would keep trading."
  },
  {
    title: "No feature nobody asked for",
    body: "Plenty of store software is sold on the length of its feature list. We would rather ship six things that work than thirty that mostly do."
  }
];

export function AboutClient() {
  return (
    <PageFrame>
      <PageHero
        eyebrow="About StoreDesk"
        title="Because the margin report took a Sunday afternoon"
        lede="StoreDesk started as a spreadsheet, a stack of supplier invoices, and the nagging feeling that nobody actually knew which items were making money."
        aside={<DataMap />}
        actions={
          <>
            <Link href="/product" className={primaryButton}>
              See what it does
            </Link>
            <a href={contactMailto({ subject: "StoreDesk — feedback" })} className={secondaryButton}>
              Tell us what is missing
            </a>
          </>
        }
      />

      <section className="mx-auto grid max-w-6xl gap-14 px-6 py-20 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <SectionHead eyebrow="The problem" title="Two numbers that never sat side by side" />
          <div className="mt-6 max-w-2xl space-y-5 text-[17.5px] leading-[1.7] text-[#17202A]">
            <p>
              A convenience store carries several thousand items. The register knows what each one
              sells for. The invoices in the filing cabinet know what each one cost. Almost nowhere
              are the two written down next to each other — so “are we making anything on this?”
              turns into an afternoon of typing.
            </p>
            <p>
              Most software sold to fix this wants to move the whole operation into a web app,
              charge per till, and stop working the moment the DSL blinks. That is a poor trade for
              a shop doing steady business on a state highway.
            </p>
            <p>
              So StoreDesk does the narrow thing well. It reads the price list off the register you
              already own, lets you record what you actually pay, and puts the two side by side — on
              the back-office PC, on a phone you can carry down the aisle, and in a sales tax return
              you can file without retyping it.
            </p>
          </div>
        </div>
        <div className="self-start rounded-[28px] bg-gradient-to-br from-[#0E43D8] via-[#1A63F4] to-[#00A87B] p-8 text-white shadow-[0_30px_70px_-30px_rgba(14,67,216,0.7)]">
          <Building2 className="h-7 w-7 text-white/85" />
          <p className="mt-5 font-[family-name:var(--font-display)] text-[26px] font-bold leading-snug tracking-tight">
            Everything on this site describes software that exists and runs in a store today.
          </p>
          <p className="mt-4 text-[16px] leading-relaxed text-white/80">
            Lottery settlement and invoice upload are on the way. Until they ship, we list them as
            planned — not as features.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <SectionHead eyebrow="What we hold to" title="Four rules the product is built around" />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {BELIEFS.map((b) => (
              <div key={b.title} className="rounded-3xl border border-[var(--border)] bg-white p-7">
                <h3 className="text-[20px] font-bold tracking-tight">{b.title}</h3>
                <p className="mt-3 text-[16px] leading-relaxed text-[var(--muted)]">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
