"use client";

import { FormEvent, useState } from "react";
import { MarketingShell } from "@/components/MarketingShell";
import { VerifoneBadge } from "@/components/VerifoneBadge";
import { SITE, contactMailto } from "@/lib/site";
import { motion } from "framer-motion";
import { Clock3, Mail, MessageSquareText, Store } from "lucide-react";

export function ContactClient() {
  const [name, setName] = useState("");
  const [store, setStore] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    window.location.href = contactMailto({
      subject: `StoreDesk inquiry — ${store || name || "store"}`,
      body: `Name: ${name}\nStore: ${store}\n\n${message}\n\n— sent from storedesk.dev contact form`
    });
  }

  return (
    <MarketingShell eyebrow="Contact" title="We read every message">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-br from-[#1A63F4] to-[#00A87B] p-6 text-white shadow-lg shadow-blue-500/25"
          >
            <Mail className="h-8 w-8 opacity-90" />
            <h2 className="mt-3 text-xl font-bold">Open your mail app</h2>
            <p className="mt-2 text-sm text-white/85">
              To is pre-filled with <strong>{SITE.email}</strong>. Subject starts as “StoreDesk inquiry”.
            </p>
            <a
              href={contactMailto({ subject: "StoreDesk inquiry" })}
              className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[var(--sd-blue)]"
            >
              Email {SITE.email}
            </a>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: Clock3, t: "Reply window", d: "Usually 1–2 business days" },
              { icon: Store, t: "Setup help", d: "Worker, Desktop, Mobile" },
              { icon: MessageSquareText, t: "Topics", d: "Install, Commander, scanning" },
              { icon: Mail, t: "Channel", d: "Email only for now" }
            ].map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.t} className="rounded-xl border border-[var(--border)] bg-white/95 p-4 shadow-sm">
                  <Icon className="h-5 w-5 text-[var(--sd-blue)]" />
                  <p className="mt-2 text-sm font-bold">{c.t}</p>
                  <p className="text-xs text-[var(--muted)]">{c.d}</p>
                </div>
              );
            })}
          </div>
          <VerifoneBadge />
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-md">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <MessageSquareText className="h-4 w-4 text-[var(--sd-green)]" />
            Optional details for the email body
          </p>
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
            placeholder="Store / company"
            value={store}
            onChange={(e) => setStore(e.target.value)}
          />
          <textarea
            className="min-h-[160px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
            placeholder="How can we help?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-[#1A63F4] to-[#00A87B] py-2.5 text-sm font-bold text-white"
          >
            Open email to {SITE.email}
          </button>
        </form>
      </div>
    </MarketingShell>
  );
}
