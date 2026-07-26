import { MarketingShell } from "@/components/MarketingShell";
import { SITE, contactMailto } from "@/lib/site";

export default function PrivacyPage() {
  return (
    <MarketingShell eyebrow="Legal" title="Privacy">
      <div className="prose max-w-3xl space-y-4 text-[var(--muted)]">
        <p>
          StoreDesk Web’s marketing site does not require an account. Internal admin tools are password-gated for the
          StoreDesk team.
        </p>
        <p>
          In the store, catalog and ops data are intended to stay on the backoffice PC running StoreDesk Worker.
          Desktop and Mobile talk only to that local Worker — not to a shared cloud product database.
        </p>
        <p>
          Contact:{" "}
          <a href={contactMailto()} className="font-semibold text-[var(--sd-blue)]">
            {SITE.email}
          </a>
        </p>
      </div>
    </MarketingShell>
  );
}
