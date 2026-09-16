"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageFrame, PageHero, SectionHead, primaryButton, secondaryButton } from "@/components/PageHero";
import { contactMailto } from "@/lib/site";

/**
 * Why the product exists.
 *
 * The hero used to carry a clickable map of which numbers sit on the store PC and which sit in the
 * account. It was a lot of interaction for a point the page already makes twice in plain words, so
 * it went; "your data stays in your store" is argued below, and the privacy page has the detail.
 */

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
    body: "StoreDesk reads from your Commander, and only sends something back when you have turned that on and a person confirms it. Nothing is pushed to a till automatically. If StoreDesk vanished tomorrow, the store would keep trading."
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
        actions={
          <>
            <Link href="/product" className={primaryButton}>
              See what it does
            </Link>
            <a href={contactMailto({ subject: "StoreDesk feedback" })} className={secondaryButton}>
              Tell us what is missing
            </a>
          </>
        }
      />

      <section className="mx-auto grid max-w-6xl gap-14 px-6 py-20 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <SectionHead eyebrow="The problem" title="The back office ran on paper and retyping" />
          <div className="mt-6 max-w-2xl space-y-5 text-[17.5px] leading-[1.7] text-[#17202A]">
            <p>
              Reports come off the register on paper. Fuel tank readings come off another printout.
              Invoices come in a stack. Every week someone sits down and copies all of it into a
              spreadsheet by hand, then reconciles the spreadsheet against the paper it came from,
              because that is the only place the numbers ever meet.
            </p>
            <p>
              Changing prices is its own afternoon. The Commander can do it, through an interface
              that was not built for a person updating a few hundred PLUs in a sitting. The software
              sold to fix that wants a monthly fee for what amounts to basic price-book work, or
              wants the whole operation in a web app that stops the moment the DSL blinks.
            </p>
            <p>
              And then there is the sales tax return, worked out from the same retyped numbers, in a
              form that has to be right.
            </p>
            <p>
              So StoreDesk reads the register directly and keeps it on your own PC: the price book
              and what you actually pay for each item, the daily and shift reports, the fuel
              readings, and a Georgia ST-3 return built from the same data you already have. No
              retyping, and nothing to reconcile against a printout.
            </p>
          </div>
        </div>
        <div className="self-start rounded-[28px] bg-gradient-to-br from-[#0E43D8] via-[#1A63F4] to-[#00A87B] p-8 text-white shadow-[0_30px_70px_-30px_rgba(14,67,216,0.7)]">
          <Building2 className="h-7 w-7 text-white/85" />
          <p className="mt-5 font-[family-name:var(--font-display)] text-[26px] font-bold leading-snug tracking-tight">
            Everything on this site describes software that exists and runs in a store today.
          </p>
          <p className="mt-4 text-[16px] leading-relaxed text-white/80">
            Two things are being built and are not here yet: EDI, so invoices from H.T. Hackney and
            the other distributors that support it land as costs without anyone typing them, and a
            lottery module for settling the daily ticket count. Until they ship we list them as
            planned, not as features.
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
