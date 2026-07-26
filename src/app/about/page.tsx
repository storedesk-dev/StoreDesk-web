"use client";

import { MarketingShell } from "@/components/MarketingShell";
import { SITE } from "@/lib/site";
import Link from "next/link";

export default function AboutPage() {
  return (
    <MarketingShell eyebrow="About" title="Why we built StoreDesk — and who ships it">
      <div className="grid gap-12 md:grid-cols-2">
        <section>
          <h2 className="text-xl font-bold">Why it was built</h2>
          <p className="mt-3 text-white/60 leading-relaxed">
            Convenience stores already have a POS brain (often Verifone Commander) and a pile of vendor invoices.
            What they lack is a calm place to reconcile sell price, vendor cost, and mobile lookup — without pretending
            to be an inventory ERP.
          </p>
          <p className="mt-4 text-white/60 leading-relaxed">
            StoreDesk started as a local-first toolkit for that gap: desktop ops next to Commander, a phone helper on
            the floor, and eventually a small cloud control plane so multi-store licensing does not require shipping
            every PLU to Atlas.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-bold">Who builds it</h2>
          <p className="mt-3 text-white/60 leading-relaxed">
            StoreDesk is built by the <strong className="text-white">storedesk-dev</strong> team — operators and
            engineers who care about c-store workflows more than generic SaaS dashboards.
          </p>
          <p className="mt-4 text-white/60 leading-relaxed">
            Product questions, license setup, and support:
          </p>
          <a href={`mailto:${SITE.email}`} className="mt-2 inline-block text-[var(--sd-mint)] hover:underline">
            {SITE.email}
          </a>
          <p className="mt-6 text-sm text-white/40">
            Open source components live on{" "}
            <a href={SITE.github} className="text-white/70 underline">
              GitHub
            </a>
            .
          </p>
        </section>
      </div>
      <div className="mt-14 rounded-2xl border border-white/10 p-8">
        <h2 className="text-xl font-bold">Principles</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-white/60">
          <li>Edge catalog stays local</li>
          <li>Invoice review before VendorPrice</li>
          <li>No stock quantity features</li>
          <li>Phone never talks to Mongo directly</li>
        </ul>
        <Link href="/how-it-works" className="mt-6 inline-block text-sm font-bold text-[var(--sd-blue)]">
          See the architecture →
        </Link>
      </div>
    </MarketingShell>
  );
}
