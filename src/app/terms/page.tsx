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
          StoreDesk is engineered exclusively for **margin tracking, invoice extraction, and price book management**. 
          <strong>StoreDesk is explicitly not a stock-count or inventory tracking system.</strong> We do not track stock quantities, warehouse locations, or low-stock alerts.
        </p>

        <h2 className="text-xl font-bold text-[var(--ink)]">2. POS Integrations</h2>
        <p>
          StoreDesk Worker relies on secure, local-network integrations with your Verifone Commander. 
          Use of these integrations must respect Verifone policies and your local network security configurations. 
          You are responsible for ensuring your store PC remains connected to the POS subnet and that firewalls allow outbound Cloud Hub syncing.
        </p>

        <h2 className="text-xl font-bold text-[var(--ink)]">3. Data Source of Truth</h2>
        <p>
          StoreDesk operates on a local-first philosophy. Your local StoreDesk Worker PC acts as the ultimate Source of Truth. 
          If WAN connectivity is lost, local pricing rules and invoice workflows remain functional, and changes will be queued and pushed to the cloud upon reconnection.
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
