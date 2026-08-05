import { MarketingShell } from "@/components/MarketingShell";
import { SITE, contactMailto } from "@/lib/site";

export default function PrivacyPage() {
  return (
    <MarketingShell eyebrow="Legal" title="Privacy Policy">
      <div className="prose max-w-3xl space-y-4 text-[var(--muted)]">
        <h2 className="text-xl font-bold text-[var(--ink)]">Our Hybrid Architecture</h2>
        <p>
          StoreDesk operates on a unique <strong>Hybrid Edge Architecture</strong> to maximize reliability and security. 
          The core system, <strong>StoreDesk Worker</strong>, runs directly on your store&apos;s back-office PC. 
        </p>
        <p>
          Your historical shift summaries, analytics, and integration settings are securely synced to our cloud database (MongoDB Atlas) 
          so you can access them instantly via the StoreDesk Mobile app, even if your store loses internet. 
        </p>
        
        <h2 className="text-xl font-bold text-[var(--ink)]">Live Data Tunneling</h2>
        <p>
          To ensure 100% accuracy, live register data (like scanning a barcode to check a price, or viewing the active unclosed shift) 
          is <strong>never cached in the cloud</strong>. Instead, the <strong>StoreDesk Cloud Hub</strong> securely tunnels your request 
          directly to your local store PC in real-time.
        </p>

        <h2 className="text-xl font-bold text-[var(--ink)]">Authentication & AppUsers</h2>
        <p>
          Access to your store data is strictly gated by <strong>Organization AppUsers</strong>. When you purchase a StoreDesk license, 
          you manage which email accounts have access to your organization. Legacy device pairing codes are no longer used.
        </p>

        <p className="pt-8 border-t border-[var(--border)] mt-8">
          Questions about data security?{" "}
          <a href={contactMailto()} className="font-semibold text-[var(--sd-blue)] hover:underline">
            {SITE.email}
          </a>
        </p>
      </div>
    </MarketingShell>
  );
}
