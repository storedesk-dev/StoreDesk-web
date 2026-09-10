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
          <h2 className="text-xl font-bold text-[var(--ink)]">Where your store data lives</h2>
          <p>
            Your catalogue, prices and sales history are stored on the back-office PC in your store. The desktop
            and phone apps read them from that PC — there is no shared cloud database holding your store&apos;s figures.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-bold text-[var(--ink)]">Mobile App Permissions & Privacy</h2>
          <p>
            StoreDesk Mobile requests minimal device permissions necessary strictly for store operation:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Camera Permission:</strong> Used only to scan product barcodes on the shop floor. Nothing the camera sees is stored or sent anywhere.
            </li>
            <li>
              <strong>Media & Photos Permission:</strong> Used only when you choose a saved photo of a barcode to look up. The image is read on the phone and not uploaded.
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
