"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, BookOpen, Check, Copy, KeyRound, LifeBuoy, Mail, MessageSquare, Plug, Send, Smartphone, Store } from "lucide-react";
import { PageFrame, PageHero } from "@/components/PageHero";
import { DOCS, SITE, contactMailto } from "@/lib/site";

/**
 * Contact.
 *
 * Still a mailto — there is no ticketing system, and a form that quietly drops
 * into an inbox is worse than the sender's own mail client. What changed: the
 * visitor picks a topic and the email is drafted with the details we would
 * otherwise have to ask for, so most problems are answered in one reply.
 */

type Topic = {
  key: string;
  label: string;
  hint: string;
  icon: ReactNode;
  subject: string;
  ask: string[];
  /** The page in the guide that answers this without an email, when there is one. */
  guide?: { href: string; label: string };
};

const TOPICS: Topic[] = [
  {
    key: "fit",
    hint: "Before you buy",
    icon: <Store className="h-4 w-4" />,
    label: "Would it work for my store?",
    subject: "StoreDesk: would this work for my store?",
    guide: { href: DOCS.home, label: "What every screen does" },
    ask: ["Register (Commander model or version, if you know it)", "How many stores", "Does the back-office PC run Windows 10 or later?"]
  },
  {
    key: "key",
    hint: "To install or reinstall",
    icon: <KeyRound className="h-4 w-4" />,
    label: "I need a setup key",
    subject: "StoreDesk setup key",
    ask: ["Store name and address", "The email address the last key went to, if there was one"]
  },
  {
    key: "register",
    hint: "Setup or connection trouble",
    icon: <Plug className="h-4 w-4" />,
    label: "The register won’t connect",
    subject: "StoreDesk: register connection",
    guide: { href: DOCS.troubleshooting, label: "Register and service troubleshooting" },
    ask: [
      "Commander address and port you entered (default 192.168.31.11 and 443)",
      "The exact message on screen, or a photo of it",
      "Can the back-office PC open the Commander’s page in a browser?"
    ]
  },
  {
    key: "phone",
    hint: "Android app trouble",
    icon: <Smartphone className="h-4 w-4" />,
    label: "Phone app",
    subject: "StoreDesk: phone app",
    guide: { href: DOCS.mobileSetup, label: "Setting up the phone app" },
    ask: ["Phone model and Android version", "What you were doing when it went wrong", "A screenshot, if you can"]
  },
  {
    key: "other",
    hint: "Anything not above",
    icon: <MessageSquare className="h-4 w-4" />,
    label: "Something else",
    subject: "StoreDesk enquiry",
    ask: ["Anything that helps us answer in one reply"]
  }
];

function Composer() {
  const [topicKey, setTopicKey] = useState(TOPICS[0].key);
  const [copied, setCopied] = useState(false);
  const reduceMotion = useReducedMotion();
  const topic = TOPICS.find((t) => t.key === topicKey) ?? TOPICS[0];

  const body = useMemo(
    () => `Hi StoreDesk,\n\n\n\n${topic.ask.map((a) => `${a}: `).join("\n")}\n`,
    [topic]
  );

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(SITE.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the address is on screen to select by hand.
    }
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white/85 shadow-[0_30px_80px_-30px_rgba(26,99,244,0.45)] backdrop-blur-xl">
      <div className="border-b border-[var(--border)] bg-gradient-to-r from-[#F5F8FF] to-[#F0FBF6] p-4">
        <p className="px-1 text-[13px] font-semibold text-[var(--muted)]">What is it about?</p>
        <div role="radiogroup" aria-label="What is it about?" className="mt-2.5 space-y-1.5">
          {TOPICS.map((t) => {
            const on = t.key === topicKey;
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTopicKey(t.key)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                  on ? "bg-white shadow-sm ring-2 ring-[#1A63F4]" : "bg-white/70 ring-1 ring-[var(--border)] hover:bg-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    on ? "bg-gradient-to-br from-[#1A63F4] to-[#00A87B] text-white" : "bg-[#F2F4F7] text-[#475467]"
                  }`}
                >
                  {t.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] font-semibold leading-tight ${on ? "text-[#1A63F4]" : "text-[#17202A]"}`}>
                    {t.label}
                  </span>
                  <span className="block text-[12.5px] leading-tight text-[var(--muted)]">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        <div className="rounded-2xl border border-[var(--border)] bg-white text-[14.5px]">
          <div className="flex gap-3 border-b border-[var(--border)] px-4 py-2.5">
            <span className="w-16 shrink-0 text-[var(--muted)]">To</span>
            <span className="font-semibold">{SITE.email}</span>
          </div>
          <div className="flex gap-3 border-b border-[var(--border)] px-4 py-2.5">
            <span className="w-16 shrink-0 text-[var(--muted)]">Subject</span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={topic.subject}
                initial={{ y: reduceMotion ? 0 : 4, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="font-semibold"
              >
                {topic.subject}
              </motion.span>
            </AnimatePresence>
          </div>
          {topic.guide ? (
            <a
              href={topic.guide.href}
              className="flex items-center gap-2.5 border-b border-[var(--border)] bg-[#F5F8FF] px-4 py-2.5 text-[13.5px] hover:bg-[#EDF3FF]"
            >
              <BookOpen className="h-4 w-4 shrink-0 text-[#1A63F4]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-[#1A63F4]">Try this first: {topic.guide.label}</span>
                <span className="block text-[12px] text-[var(--muted)]">Most of these are answered there in a minute.</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-[#1A63F4]" aria-hidden />
            </a>
          ) : null}
          <div className="px-4 py-3.5">
            <p className="text-[13px] font-semibold text-[var(--muted)]">We will ask for these, so they are already in the draft:</p>
            <ul className="mt-2.5 space-y-2">
              {topic.ask.map((a) => (
                <motion.li
                  key={`${topic.key}-${a}`}
                  initial={{ x: reduceMotion ? 0 : 8 }}
                  animate={{ x: 0 }}
                  className="flex gap-2.5 text-[15px] leading-snug"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#00A87B]" />
                  {a}
                </motion.li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <a
            href={contactMailto({ subject: topic.subject, body })}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#1A63F4] to-[#00A87B] px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_8px_22px_-8px_rgba(26,99,244,0.6)] hover:brightness-110"
          >
            <Send className="h-4 w-4" /> Open in my email app
          </a>
          <button
            type="button"
            onClick={copyAddress}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-2.5 text-[15px] font-semibold text-[#17202A] hover:border-[#1A63F4]/40"
          >
            {copied ? <Check className="h-4 w-4 text-[#00A87B]" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy address"}
          </button>
        </div>
      </div>
    </div>
  );
}

const NOTES = [
  {
    title: "A person reads it",
    body: "Small team, no call centre, no bot. Whoever replies has worked on the code."
  },
  {
    title: "Photos beat descriptions",
    body: "If a screen showed an error, a phone photo of it usually saves a round trip."
  },
  {
    title: "Say which part",
    body: "The desktop app, the phone app, or the setup on the store PC, and roughly when it started."
  }
];

/**
 * The guide, before the inbox.
 *
 * Most of what people write in about — the register not connecting, a phone that will not sign in,
 * what a screen is for — already has a page with screenshots. Sending those to email is slower for
 * the store and slower for us, so the guide leads and the composer is for what is genuinely left:
 * a setup key, a question before buying, and anything the guide did not answer.
 */
const FIRST_STOPS = [
  {
    href: DOCS.troubleshooting,
    title: "Something is not working",
    body: "The service will not start, the register will not answer, phones cannot reach the store."
  },
  {
    href: DOCS.install,
    title: "Installing or setting up",
    body: "Every step of a first setup, with a screenshot of each screen."
  },
  {
    href: DOCS.home,
    title: "How a screen works",
    body: "Every desktop screen and every phone screen, explained one by one."
  }
];

export function ContactClient() {
  return (
    <PageFrame>
      <PageHero
        eyebrow="Contact"
        title="Talk to the people who built it"
        lede="Most questions are answered in the guide in a minute. When they are not, pick what it is about and we will start the email for you, with the details we would otherwise have to ask for."
        aside={<Composer />}
      >
        <div className="mt-7 space-y-2.5">
          <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em] text-[#00875F]">
            <LifeBuoy className="h-4 w-4" aria-hidden />
            Try the guide first
          </p>
          {FIRST_STOPS.map((stop) => (
            <a
              key={stop.href}
              href={stop.href}
              className="group flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 backdrop-blur transition-colors hover:border-[#1A63F4]/40"
            >
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-[#1A63F4]" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-semibold">{stop.title}</span>
                <span className="block text-[14px] leading-snug text-[var(--muted)]">{stop.body}</span>
              </span>
              <ArrowUpRight
                className="mt-0.5 h-4 w-4 shrink-0 text-[#1A63F4] opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </a>
          ))}
        </div>

        <a
          href={contactMailto()}
          className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/80 px-4 py-3 backdrop-blur hover:border-[#1A63F4]/40"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1A63F4] to-[#00A87B] text-white">
            <Mail className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-[13px] text-[var(--muted)]">Or write in your own words</span>
            <span className="block text-[17px] font-semibold text-[#1A63F4]">{SITE.email}</span>
          </span>
        </a>
      </PageHero>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-4 md:grid-cols-3">
          {NOTES.map((n) => (
            <div key={n.title} className="rounded-3xl border border-[var(--border)] bg-white p-6">
              <h2 className="text-[18px] font-bold tracking-tight">{n.title}</h2>
              <p className="mt-2 text-[15.5px] leading-relaxed text-[var(--muted)]">{n.body}</p>
            </div>
          ))}
        </div>
      </section>
    </PageFrame>
  );
}
