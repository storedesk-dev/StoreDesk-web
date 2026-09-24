import { MarketingShell } from "@/components/MarketingShell";
import { LegalCallout, LegalContents, LegalSection } from "@/components/LegalPage";
import { Clock, HardDrive, Mail, Trash2, UserCheck } from "lucide-react";
import { SITE, contactMailto } from "@/lib/site";
import { pageMetadata } from "@/lib/metadata";

/**
 * How to have a StoreDesk account and its data deleted, without installing anything.
 *
 * Google Play expects a public page a person can reach from outside the app, and the privacy page
 * already promises deletion on request. StoreDesk has no self-service delete: a person writes to
 * support and StoreDesk removes the account by hand, so this page says exactly that, what goes, what
 * is kept and for how long, and it is honest that the store's own sales data never left the store PC
 * and so can only be deleted there.
 */

export const metadata = pageMetadata({
  title: "Delete your account",
  description: "How to have your StoreDesk account and the data behind it deleted, and what happens to the store data on your own PC.",
  path: "/delete-account"
});

const UPDATED = "17 September 2026";

const SECTIONS = [
  { id: "ask", title: "How to ask" },
  { id: "removed", title: "What is deleted" },
  { id: "store-pc", title: "The data on your store PC" },
  { id: "kept", title: "What is kept, and why" },
  { id: "how-long", title: "How long it takes" }
];

const MAILTO = contactMailto({
  subject: "Delete my StoreDesk account",
  body: [
    "Please delete my StoreDesk account and the data behind it.",
    "",
    "Name on the account:",
    "Email on the account:",
    "Organization tag (if you know it):",
    "Store name (if this is about one store):",
    ""
  ].join("\n")
});

export default function DeleteAccountPage() {
  return (
    <MarketingShell
      eyebrow="Your account"
      title="Delete your account"
      lede={`Write to us and we delete your account and the data behind it. Last updated ${UPDATED}.`}
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="max-w-3xl space-y-8">
          <LegalSection id="ask" index={1} icon={<Mail className="h-4.5 w-4.5" />} title="How to ask">
            <p>
              Email <a className="font-semibold text-[#1A63F4] hover:underline" href={MAILTO}>{SITE.email}</a> from the
              address on the account, and say it is a deletion request. Tell us the name on the account and, if you
              know it, your store number. If you are the owner and want every store removed, say so.
            </p>
            <p>
              We reply to confirm it is you before anything is deleted. If you cannot write from the address on the
              account, tell us and we will find another way to check.
            </p>
            <p>
              <a
                className="inline-flex items-center gap-2 rounded-xl bg-[#1A63F4] px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-[#1550cc]"
                href={MAILTO}
              >
                <Trash2 className="h-4 w-4" />
                Write the email
              </a>
            </p>
          </LegalSection>

          <LegalSection id="removed" index={2} icon={<UserCheck className="h-4.5 w-4.5" />} title="What is deleted">
            <p>Your StoreDesk account: your name, your email, your password and the devices you signed in on.</p>
            <p>
              If you ask for a store: the store itself, its PC registrations, its licence, its people,
              and the register address and password we hold for it. The tunnel that let your phones reach the store is
              removed with it.
            </p>
          </LegalSection>

          <LegalSection id="store-pc" index={3} icon={<HardDrive className="h-4.5 w-4.5" />} title="The data on your store PC">
            <p>
              Your prices, costs, sales history and tax working never reach us. They live on your own store PC, so we
              cannot delete them and neither can anyone else remotely.
            </p>
            <p>
              To remove them, uninstall StoreDesk on that PC and tick <strong>Remove store data</strong>. Until you do,
              the only copy stays on the PC and in its local backups.
            </p>
          </LegalSection>

          <LegalSection id="kept" index={4} icon={<Clock className="h-4.5 w-4.5" />} title="What is kept, and why">
            <p>
              We keep a record that an account existed and what was done with it — created, activated, replaced,
              deleted, and by whom — for twelve months. It is how we answer a later question about a store PC being
              replaced or access being removed, and it holds names and email addresses.
            </p>
            <p>Emails you send us stay in our mailbox so we can carry on the conversation.</p>
            <LegalCallout tone="info">
              If you want the record removed too, say so in your email and we will tell you what we can delete and what
              we have to keep.
            </LegalCallout>
          </LegalSection>

          <LegalSection id="how-long" index={5} icon={<Clock className="h-4.5 w-4.5" />} title="How long it takes">
            <p>
              We confirm within a few days and delete within 30 days of confirming. We write to you once it is done.
            </p>
          </LegalSection>
        </div>

        <LegalContents sections={SECTIONS} />
      </div>
    </MarketingShell>
  );
}
