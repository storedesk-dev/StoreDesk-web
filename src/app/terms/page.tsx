import { MarketingShell } from "@/components/MarketingShell";
import { SITE, contactMailto } from "@/lib/site";

export default function TermsPage() {
  return (
    <MarketingShell eyebrow="Legal" title="Terms of Service">
      <div className="max-w-3xl space-y-4 text-[var(--muted)] prose">
        <p>
          StoreDesk software is provided for convenience store and gas station locations operating Verifone Commander or Ruby POS systems.
        </p>
        
        <h2 className="text-xl font-bold text-[var(--ink)]">1. Core Functionality</h2>
        <p>
          StoreDesk is built for <strong>margin tracking, wholesale cost comparison, and price book management</strong>.
          It is not an inventory system and does not track stock quantities or reorder levels.
        </p>

        <h2 className="text-xl font-bold text-[var(--ink)]">2. POS Integrations</h2>
        <p>
          StoreDesk Worker relies on secure, local-network integrations with your Verifone Commander. 
          Use of these integrations must respect Verifone policies and your local network security configurations. 
          You are responsible for ensuring your store PC remains connected to the POS subnet and that firewalls allow outbound Cloud Hub syncing.
        </p>

        <h2 className="text-xl font-bold text-[var(--ink)]">3. Data Source of Truth</h2>
        <p>
          StoreDesk operates on a local-first philosophy. Your local StoreDesk Worker PC is the source of truth for all
          pricing and vendor cost data. Product data, vendor prices, and pricing rules are stored on your hardware
          and are not shared with third parties.
        </p>

        <p className="pt-8 border-t border-[var(--border)] mt-8">
          Questions regarding these terms?{" "}
          <a href={contactMailto()} className="font-semibold text-[var(--sd-blue)] hover:underline">
            {SITE.email}
          </a>
        </p>
      </div>
    </MarketingShell>
  );
}
