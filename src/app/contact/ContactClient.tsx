"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Mail, MessageSquare, Wrench } from "lucide-react";
import { MarketingShell } from "@/components/MarketingShell";
import { SITE, contactMailto } from "@/lib/site";

/**
 * Contact.
 *
 * A mailto, not a form. There is no ticketing system behind this, and a form
 * that quietly drops into an inbox is a worse experience than a link that opens
 * the sender's own mail client with a useful subject line already filled in.
 */

const REASONS = [
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Thinking about it",
    body: "Whether StoreDesk fits your setup, what the register needs to have, how long it takes to get going.",
    subject: "StoreDesk — would this work for my store?",
    cta: "Ask a question"
  },
  {
    icon: <Wrench className="h-5 w-5" />,
    title: "Already running it",
    body: "Something not working, a register that will not connect, or a setup key that has expired.",
    subject: "StoreDesk — support",
    cta: "Get help"
  },
  {
    icon: <Mail className="h-5 w-5" />,
    title: "Something else",
    body: "A feature you need, a bill, or anything the other two do not cover.",
    subject: "StoreDesk enquiry",
    cta: "Send a message"
  }
];

export function ContactClient() {
  const reduceMotion = useReducedMotion();

  return (
    <MarketingShell
      eyebrow="Contact"
      title="Talk to the people who built it"
      lede="Small team, no call centre. Whoever replies has worked on the code."
    >
      <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">
        {REASONS.map((reason, index) => (
          <motion.div
            key={reason.title}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{
              duration: reduceMotion ? 0 : 0.4,
              delay: reduceMotion ? 0 : index * 0.06,
              ease: [0.22, 1, 0.36, 1]
            }}
            className="flex flex-col bg-white p-7"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A63F4]/8 text-[#1A63F4]">
              {reason.icon}
            </span>
            <h2 className="mt-4 text-[16px] font-semibold tracking-tight">{reason.title}</h2>
            <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--muted)]">
              {reason.body}
            </p>
            <a
              href={contactMailto({ subject: reason.subject })}
              className="mt-5 inline-flex w-fit items-center gap-1.5 text-[14px] font-semibold text-[#1A63F4] hover:underline"
            >
              {reason.cta}
              <span aria-hidden>→</span>
            </a>
          </motion.div>
        ))}
      </div>

      <section className="mt-14 rounded-2xl border border-[var(--border)] bg-[#FBFCFD] p-8 md:p-10">
        <h2 className="text-[19px] font-semibold tracking-tight">Or just email us</h2>
        <a
          href={contactMailto()}
          className="mt-2 inline-block text-[18px] font-medium text-[#1A63F4] hover:underline"
        >
          {SITE.email}
        </a>
        <p className="mt-5 max-w-2xl text-[14.5px] leading-relaxed text-[var(--muted)]">
          If you are writing about a problem, it helps to say which part you are using — the
          desktop app, the phone app, or the setup on the store PC — and roughly when it
          started. If a screen showed an error, a photo of it saves a round trip.
        </p>
      </section>
    </MarketingShell>
  );
}
