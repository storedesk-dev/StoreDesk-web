"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { contactMailto } from "@/lib/site";

/**
 * Why the product exists.
 *
 * Written from the problem, not from a mission statement. A store owner
 * evaluating software wants to know the author has stood behind a counter;
 * "our core focus areas for store operations" told them nothing.
 */

const BELIEFS = [
  {
    title: "Your data stays in your store",
    body: "Sales figures, margins and supplier prices are the most sensitive numbers a small retailer has. There is no good reason for them to sit on somebody else's server, so they do not. The cloud side of StoreDesk knows your store exists and that your licence is paid. It does not know what you sold today."
  },
  {
    title: "It has to work when the line is down",
    body: "Rural stores lose internet. A back office that becomes a blank screen when that happens is not a back office. Everything that matters runs on the PC in the room."
  },
  {
    title: "The register is the source of truth",
    body: "StoreDesk reads from your Commander and never writes to it. Nothing we do can put a wrong price on a till or break a lane during a rush. If StoreDesk disappeared tomorrow, the store would keep trading."
  },
  {
    title: "No feature nobody asked for",
    body: "Half the software sold to convenience stores is priced on a feature list. We would rather ship six things that work than thirty that mostly do."
  }
];

export function AboutClient() {
  const reduceMotion = useReducedMotion();

  return (
    <MarketingShell
      eyebrow="Why we built it"
      title="Because the margin report took a Sunday afternoon"
      lede="StoreDesk started as a spreadsheet, a stack of supplier invoices, and the nagging feeling that nobody actually knew which items were making money."
    >
      <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr]">
        <div className="max-w-2xl space-y-5 text-[16px] leading-[1.7] text-[var(--foreground)]">
          <p>
            A convenience store carries several thousand items. The register knows what each
            one sells for. The invoices in the filing cabinet know what each one cost. Almost
            nowhere are those two numbers written down next to each other — so the question
            &ldquo;are we making anything on this?&rdquo; turns into an afternoon of typing.
          </p>
          <p>
            Most of the software sold to fix this wants to move your whole operation into a
            web app, charge per till, and stop working the moment the DSL blinks. That is a
            poor trade for a shop doing steady business on a state highway.
          </p>
          <p>
            So StoreDesk does the narrow thing well. It reads the price list off the register
            you already own, lets you record what you actually pay your suppliers, and puts
            those two numbers side by side — on the back-office PC, in a phone app you can
            carry down the aisle, and in a sales tax return you can file without retyping it.
          </p>
          <p className="border-l-2 border-[#1A63F4] pl-4 text-[var(--muted)]">
            Everything on this site describes software that exists and is running in a store.
            Where we have not built something yet, we say so rather than putting it on a
            roadmap slide.
          </p>
        </div>

        <div className="space-y-px self-start overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)]">
          {BELIEFS.map((belief, index) => (
            <motion.div
              key={belief.title}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: reduceMotion ? 0 : 0.4,
                delay: reduceMotion ? 0 : index * 0.06,
                ease: [0.22, 1, 0.36, 1]
              }}
              className="bg-white p-6"
            >
              <h2 className="text-[15.5px] font-semibold tracking-tight">{belief.title}</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">{belief.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <section className="mt-16 flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[#FBFCFD] p-8 sm:flex-row sm:items-center sm:justify-between md:p-10">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight">Run a store? Tell us what is missing.</h2>
          <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-[var(--muted)]">
            The feature list has been shaped almost entirely by people who work behind a
            counter. If StoreDesk does not do something you need, that is worth an email.
          </p>
        </div>
        <div className="flex shrink-0 gap-2.5">
          <a
            href={contactMailto({ subject: "StoreDesk — feedback" })}
            className="rounded-lg bg-[#1A63F4] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#0E43D8]"
          >
            Send a note
          </a>
          <Link
            href="/product"
            className="rounded-lg border border-[var(--border)] bg-white px-4 py-2.5 text-[14px] font-semibold transition-colors hover:border-[#1A63F4]/40"
          >
            See what it does
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
