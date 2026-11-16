import { Check, Monitor, Ticket } from "lucide-react";
import { PACKAGES, contactMailto } from "@/lib/site";

/**
 * The three packages a store can buy, as three cards; the combined one is highlighted with the brand
 * gradient. No prices: each store's price is agreed with it, so every card asks.
 */
export function Packages({ className = "" }: { className?: string }) {
  return (
    <ul className={`grid gap-5 lg:grid-cols-3 lg:items-stretch ${className}`}>
      {PACKAGES.map((pack) => (
        <li
          key={pack.id}
          className={`relative flex flex-col rounded-[var(--radius-lg)] p-[2px] ${
            pack.featured ? "bg-gradient-to-br from-[#1a63f4] to-[#00a87b] shadow-[var(--shadow-brand)]" : "bg-[rgba(14,67,216,0.1)]"
          }`}
        >
          <div className="flex flex-1 flex-col rounded-[calc(var(--radius-lg)-2px)] bg-white p-6">
            {pack.featured ? (
              <span className="mb-3 w-fit rounded-full bg-gradient-to-r from-[#1a63f4] to-[#00875f] px-3 py-1 text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-white">
                The full set
              </span>
            ) : null}
            <div className="flex items-center gap-3">
              <span className="sd-icon-tile !h-11 !w-11">
                {pack.id === "lottery" ? <Ticket className="h-5 w-5" aria-hidden /> : <Monitor className="h-5 w-5" aria-hidden />}
              </span>
              <h3 className="text-[22px] font-extrabold tracking-[-0.02em]">{pack.name}</h3>
            </div>
            <p className="mt-3 text-[16.5px] leading-relaxed text-[var(--muted)]">{pack.line}</p>
            <p className="mt-4 flex flex-wrap gap-1.5">
              {pack.apps.map((app) => (
                <span key={app} className="rounded-full bg-[var(--blue-tint)] px-2.5 py-1 text-[13px] font-bold text-[var(--blue-ink)]">
                  {app}
                </span>
              ))}
            </p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {pack.points.map((point) => (
                <li key={point} className="flex gap-2.5 text-[16px] leading-snug">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--green)]" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <a
              href={contactMailto({ subject: `StoreDesk price: ${pack.name}` })}
              className={`mt-6 w-full ${pack.featured ? "sd-btn" : "sd-btn-ghost"}`}
            >
              Ask for a price
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
