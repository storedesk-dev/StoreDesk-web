import { MarketingShell } from "@/components/MarketingShell";
import { SITE } from "@/lib/site";

export default function PrivacyPage() {
  return (
    <MarketingShell eyebrow="Legal" title="Privacy">
      <div className="prose prose-invert max-w-3xl space-y-4 text-white/60">
        <p>
          StoreDesk Web’s marketing site does not require an account. License admin is password-gated and used by the
          StoreDesk team.
        </p>
        <p>
          Store catalog data is intended to remain on the store’s edge computers. Atlas is used for store licenses and
          registry fields (STORE_ID, AGENT_KEY, support dates), not for full product catalogs.
        </p>
        <p>
          Contact:{" "}
          <a href={`mailto:${SITE.email}`} className="text-[var(--sd-mint)]">
            {SITE.email}
          </a>
        </p>
      </div>
    </MarketingShell>
  );
}
