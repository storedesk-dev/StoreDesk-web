import { MarketingShell } from "@/components/MarketingShell";
import { SITE, contactMailto } from "@/lib/site";

export default function TermsPage() {
  return (
    <MarketingShell eyebrow="Legal" title="Terms">
      <div className="max-w-3xl space-y-4 text-[var(--muted)]">
        <p>
          StoreDesk software is provided for store locations that run Worker on a backoffice PC and use Desktop and
          Mobile as documented.
        </p>
        <p>
          StoreDesk is not a stock / inventory-count system. Use of Commander integrations must respect Verifone and
          local network policies.
        </p>
        <p>
          Questions:{" "}
          <a href={contactMailto()} className="font-semibold text-[var(--sd-blue)]">
            {SITE.email}
          </a>
        </p>
      </div>
    </MarketingShell>
  );
}
