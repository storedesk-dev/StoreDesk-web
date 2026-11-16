"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { DOCS, SITE, contactMailto } from "@/lib/site";

/**
 * The email composer.
 *
 * Still a mailto: there is no ticketing system, and a form that quietly drops into an inbox is
 * worse than the sender's own mail client. The visitor picks a topic and the email is drafted with
 * the details we would otherwise have to ask for, so most questions are answered in one reply.
 */

type Topic = {
  key: string;
  label: string;
  subject: string;
  ask: string[];
  /** The page in the guide that answers this without an email, when there is one. */
  guide?: { href: string; label: string };
};

const TOPICS: Topic[] = [
  {
    key: "fit",
    label: "Would it work for my store?",
    subject: "StoreDesk: would this work for my store?",
    ask: ["Register (Commander model or version, if you know it)", "How many stores", "Does the back-office PC run Windows 10 or later?"]
  },
  {
    key: "key",
    label: "I need a setup key",
    subject: "StoreDesk setup key",
    ask: ["Store name and address", "The email address the last key went to, if there was one"]
  },
  {
    key: "register",
    label: "The register won't connect",
    subject: "StoreDesk: register connection",
    guide: { href: DOCS.troubleshooting, label: "Register and service troubleshooting" },
    ask: [
      "Commander address and port you entered",
      "The exact message on screen, or a photo of it",
      "Can the back-office PC open the Commander's page in a browser?"
    ]
  },
  {
    key: "phone",
    label: "Phone app",
    subject: "StoreDesk: phone app",
    guide: { href: DOCS.mobileSetup, label: "Setting up the phone app" },
    ask: ["Phone model and Android version", "What you were doing when it went wrong", "A screenshot, if you can"]
  },
  {
    key: "lottery",
    label: "StoreDesk Lottery",
    subject: "StoreDesk Lottery",
    guide: { href: DOCS.lottery, label: "The StoreDesk Lottery guide" },
    ask: ["Store name", "Is StoreDesk already on a PC in the store?", "Which PC will run it at the lottery counter?"]
  },
  {
    key: "other",
    label: "Something else",
    subject: "StoreDesk enquiry",
    ask: ["Anything that helps us answer in one reply"]
  }
];

export function Composer() {
  const [topicKey, setTopicKey] = useState(TOPICS[0].key);
  const [copied, setCopied] = useState(false);
  const topic = TOPICS.find((t) => t.key === topicKey) ?? TOPICS[0];

  const body = useMemo(() => `Hi StoreDesk,\n\n\n\n${topic.ask.map((a) => `${a}: `).join("\n")}\n`, [topic]);

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
    <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-white">
      <div className="border-b border-[var(--line)] p-5">
        <p id="topic-label" className="text-[16px] font-bold">
          What is it about?
        </p>
        <div role="group" aria-labelledby="topic-label" className="mt-3 flex flex-wrap gap-2">
          {TOPICS.map((t) => {
            const on = t.key === topicKey;
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                onClick={() => setTopicKey(t.key)}
                className={`min-h-11 rounded-full border px-4 text-[15px] font-semibold transition-colors ${
                  on ? "border-[var(--blue)] bg-[var(--blue)] text-white" : "border-[var(--line-strong)] bg-white hover:border-[var(--blue)]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        <dl className="divide-y divide-[var(--line)] rounded-[var(--radius-md)] border border-[var(--line)] text-[16px]">
          <div className="flex gap-3 px-4 py-3">
            <dt className="w-16 shrink-0 text-[var(--muted)]">To</dt>
            <dd className="min-w-0 break-all font-semibold">{SITE.email}</dd>
          </div>
          <div className="flex gap-3 px-4 py-3">
            <dt className="w-16 shrink-0 text-[var(--muted)]">Subject</dt>
            <dd className="min-w-0 font-semibold">{topic.subject}</dd>
          </div>
        </dl>

        {topic.guide ? (
          <p className="mt-4 text-[16px]">
            Try this first:{" "}
            <a href={topic.guide.href} className="sd-link">
              {topic.guide.label}
            </a>
          </p>
        ) : null}

        <p className="mt-4 text-[15px] font-semibold text-[var(--muted)]">Already in the draft, so we need not ask:</p>
        <ul className="mt-2 space-y-2">
          {topic.ask.map((a) => (
            <li key={`${topic.key}-${a}`} className="flex gap-2.5 text-[16px] leading-snug">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--green-ink)]" aria-hidden />
              {a}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={contactMailto({ subject: topic.subject, body })}
            className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--blue)] px-5 text-[16px] font-bold text-white hover:bg-[var(--blue-ink)]"
          >
            <Send className="h-4 w-4" aria-hidden /> Open in my email app
          </a>
          <button
            type="button"
            onClick={copyAddress}
            className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white px-4 text-[16px] font-semibold hover:border-[var(--blue)]"
          >
            {copied ? <Check className="h-4 w-4 text-[var(--green-ink)]" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            <span aria-live="polite">{copied ? "Copied" : "Copy address"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
