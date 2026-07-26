import { MarketingShell } from "@/components/MarketingShell";
import { SITE } from "@/lib/site";

export default function TermsPage() {
  return (
    <MarketingShell eyebrow="Legal" title="Terms">
      <div className="max-w-3xl space-y-4 text-[var(--muted)]">
        <p>
          StoreDesk software is provided for licensed store locations. Support is available only through the support
          period attached to each license (trial or custom end date).
        </p>
        <p>
          StoreDesk is not a stock / inventory-count system. Use of Commander integrations must respect Verifone and
          local network policies.
        </p>
        <p>
          Questions:{" "}
          <a href={`mailto:${SITE.email}`} className="text-[var(--sd-mint)]">
            {SITE.email}
          </a>
        </p>
      </div>
    </MarketingShell>
  );
}
