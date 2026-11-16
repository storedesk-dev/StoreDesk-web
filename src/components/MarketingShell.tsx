import type { ReactNode } from "react";
import { PageFrame } from "@/components/PageHero";

/**
 * Frame for the text pages: privacy, terms, account deletion, and the account pages a link in an
 * email opens (enroll, verify, reset password). A white header block with the h1 and one sentence,
 * then the content on the wash.
 *
 * No directive and no hooks, so it renders on the server for the legal pages and inside the client
 * components of the account pages alike. `eyebrow` is accepted for those callers and shown as a
 * plain sentence-case label.
 */
export function MarketingShell({
  children,
  title,
  eyebrow,
  lede
}: {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  lede?: string;
}) {
  return (
    <PageFrame>
      <div className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
          {eyebrow ? <p className="sd-label">{eyebrow}</p> : null}
          <h1 className={`sd-h1 max-w-3xl ${eyebrow ? "mt-3" : ""}`}>{title}</h1>
          {lede ? <p className="sd-lede mt-5">{lede}</p> : null}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">{children}</div>
    </PageFrame>
  );
}
