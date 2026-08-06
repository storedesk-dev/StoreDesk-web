import { MarketingShell } from "@/components/MarketingShell";
import { SITE, contactMailto } from "@/lib/site";

export default function PrivacyPage() {
  return (
    <MarketingShell eyebrow="Legal" title="Privacy Policy">
      <div className="prose max-w-3xl space-y-6 text-[var(--muted)]">
        <section className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--ink)]">Overview</h2>
          <p>
            StoreDesk Web’s marketing site does not require an account. Internal admin tools are password-gated for the StoreDesk team.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--ink)]">Local-First Store Data Architecture</h2>
          <p>
            In the store, catalog and ops data are intended to stay on the backoffice PC running StoreDesk Worker. 
            StoreDesk Desktop and Mobile talk only to that local Worker — not to a shared cloud product database.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--ink)]">Mobile App Permissions & Privacy</h2>
          <p>
            StoreDesk Mobile requests minimal device permissions necessary strictly for store operation:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Camera Permission:</strong> Used exclusively for scanning product UPC barcodes, QR codes, and vendor invoice items in real time.
            </li>
            <li>
              <strong>Media & Photos Permission:</strong> Used solely when a user explicitly chooses to select a stored barcode photo or vendor invoice image from device storage.
            </li>
          </ul>
          <p>
            StoreDesk does not track users, does not use advertising identifiers (AD_ID), and does not sell or share personal data with third parties.
          </p>
        </section>

        <section className="pt-6 border-t border-[var(--border)]">
          <h2 className="text-xl font-bold text-[var(--ink)]">Contact Us</h2>
          <p className="mt-2">
            For any questions or privacy inquiries, please contact us at:{" "}
            <a href={contactMailto()} className="font-semibold text-[var(--sd-blue)] hover:underline">
              {SITE.email}
            </a>
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
