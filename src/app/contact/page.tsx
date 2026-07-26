"use client";

import { FormEvent, useState } from "react";
import { MarketingShell } from "@/components/MarketingShell";
import { SITE } from "@/lib/site";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [store, setStore] = useState("");
  const [message, setMessage] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`StoreDesk inquiry — ${store || name || "store"}`);
    const body = encodeURIComponent(
      `Name: ${name}\nStore: ${store}\n\n${message}\n\n— sent from storedesk.dev contact form`
    );
    window.location.href = `mailto:${SITE.email}?subject=${subject}&body=${body}`;
  }

  return (
    <MarketingShell eyebrow="Contact" title="We read every message">
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <p className="text-[var(--muted)] leading-relaxed">
            Licensing, trials, support windows, and product questions go to the StoreDesk inbox.
          </p>
          <a
            href={`mailto:${SITE.email}`}
            className="mt-6 inline-block text-2xl font-bold text-[var(--sd-blue)] hover:underline"
          >
            {SITE.email}
          </a>
          <p className="mt-4 text-sm text-[var(--muted)]">Typical reply within 1–2 business days.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
            placeholder="Store / company"
            value={store}
            onChange={(e) => setStore(e.target.value)}
          />
          <textarea
            className="min-h-[140px] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
            placeholder="How can we help?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-[#1A63F4] to-[#00A87B] py-2.5 text-sm font-bold"
          >
            Open email to {SITE.email}
          </button>
        </form>
      </div>
    </MarketingShell>
  );
}
