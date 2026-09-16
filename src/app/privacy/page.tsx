import { MarketingShell } from "@/components/MarketingShell";
import { DataTable, LegalCallout, LegalContents, LegalHighlights, LegalSection, LegalSplit } from "@/components/LegalPage";
import { Building2, Camera, Clock, Globe, HardDrive, KeyRound, Lock, Monitor, Share2, ShieldCheck, UserCheck } from "lucide-react";
import { DOCS, PLANS, SITE, contactMailto } from "@/lib/site";

/**
 * What StoreDesk holds, where it holds it, and who else ever sees it.
 *
 * Written against the system as it is built: store data in SQLite on the store PC, the control plane
 * holding only the account, and the two third parties a store can switch on (Cloudflare for the phone
 * tunnel, Google for the Sheets export). The previous version said "there is no shared cloud database"
 * and stopped, which left every one of those questions unanswered.
 */

const UPDATED = "16 September 2026";

const SECTIONS = [
  { id: "summary", title: "The short version" },
  { id: "store-pc", title: "What stays on your store PC" },
  { id: "account", title: "What your StoreDesk account holds" },
  { id: "register", title: "Your register credentials" },
  { id: "third-parties", title: "Who else can see anything" },
  { id: "mobile", title: "The phone app's permissions" },
  { id: "website", title: "This website" },
  { id: "retention", title: "How long things are kept" },
  { id: "rights", title: "Your choices" },
  { id: "contact", title: "Contact" }
];

export default function PrivacyPage() {
  return (
    <MarketingShell
      eyebrow="Legal"
      title="Privacy"
      lede={`What StoreDesk holds, where it is held, and who else can see it. Last updated ${UPDATED}.`}
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="max-w-3xl space-y-8">
          <LegalHighlights
            items={[
              { value: "None", label: "Of your prices, costs or sales ever reaches us", tone: "good" },
              { value: "Zero", label: "Analytics, advertising or tracking, on the site and in the app", tone: "good" },
              { value: "2", label: "Optional features send anything outside your store, both off by default" }
            ]}
          />

          <LegalSplit
            left={{
              title: "On your store PC",
              note: "Yours. We cannot read any of it.",
              icon: <HardDrive className="h-5 w-5" />,
              items: [
                "Price book, PLUs, departments and shelf prices",
                "What you pay each supplier, price groups and deals",
                "Sales: daily, shift and monthly reports, and single transactions",
                "Fuel grades and pump prices",
                "Sales tax working and the returns built from it",
                "Staff accounts, with passwords that cannot be read back"
              ]
            }}
            right={{
              title: "In your StoreDesk account",
              note: "What a licence needs, and nothing else.",
              icon: <Building2 className="h-5 w-5" />,
              items: [
                "Your organisation, and the stores it has",
                "People: name, email, role",
                "Which store PCs are connected",
                "Licence and plan",
                "A log of account changes"
              ]
            }}
          />

          <LegalSection id="summary" index={1} icon={<ShieldCheck className="h-4.5 w-4.5" />} title="The short version">
            <p>
              StoreDesk is local-first. Your price book, what you pay your suppliers, your sales history and
              your sales tax working all live in a database file on the back-office PC in your store. They are
              not copied to us, and we cannot read them.
            </p>
            <LegalCallout>
              If you asked us today what your store sold yesterday, we could not tell you. We do not have it.
            </LegalCallout>
          </LegalSection>

          <LegalSection id="store-pc" index={2} icon={<HardDrive className="h-4.5 w-4.5" />} title="What stays on your store PC">
            <p>
              StoreDesk keeps your store&rsquo;s data in its own storage on the back-office PC, locked down so
              that only that PC&rsquo;s administrators and StoreDesk itself can open it. It holds:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>the price book read from your register: PLUs, descriptions, departments and shelf prices;</li>
              <li>the supplier costs you enter, and the price groups and deals built from them;</li>
              <li>sales read from the register: daily, shift and monthly reports, and individual transactions;</li>
              <li>fuel grades and pump prices;</li>
              <li>sales tax working and the returns generated from it;</li>
              <li>the staff accounts that may sign in at this store, with passwords stored in a hashed form that cannot be read back;</li>
              <li>logs of what the service did, kept on the same PC.</li>
            </ul>
            <LegalCallout>
              <span className="inline-flex items-center gap-2 font-semibold text-[#17202A]">
                <Monitor className="h-4 w-4 text-[#1A63F4]" aria-hidden />
                None of this is sent to StoreDesk.
              </span>{" "}
              The desktop app reads it from that PC directly, and the phone app reaches the same PC through
              the secure connection described below.
            </LegalCallout>
          </LegalSection>

          <LegalSection id="account" index={3} icon={<Building2 className="h-4.5 w-4.5" />} title="What your StoreDesk account holds">
            <p>
              The account lives on our servers and exists so a licence can be issued and a store PC can prove
              it is yours. It holds this and nothing more:
            </p>
            <DataTable
              columns={["What", "Why", "Example"]}
              rows={[
                ["Organisation and stores", "So a licence covers the right stores.", "Business name, store name and address"],
                ["People", "So they can sign in and be given a role.", "Name, email address and role"],
                ["Installations", "So each store PC has its own identity and can be replaced on its own.", "Which PCs are connected, and when"],
                ["Licence", "So we know the plan and when it renews.", `${PLANS.trialDays}-day trial, then a ${PLANS.standardDays}-day plan`],
                ["Audit log", "So account changes can be traced.", "Who added a store, who changed a role, and when"]
              ]}
            />
            <p>It holds no prices, no costs, no transactions and no sales totals.</p>
          </LegalSection>

          <LegalSection id="register" index={4} icon={<KeyRound className="h-4.5 w-4.5" />} title="Your register credentials">
            <p>
              Connecting to a Verifone Commander needs a username and password for the register. That password
              is stored encrypted, and it is write-only: you can set it, and nobody can read it back.
            </p>
            <LegalCallout tone="warn">
              Once saved, the register password is never shown again, never returned to the admin console, and
              never included in a support export. The only place it is ever used is your own store&rsquo;s PC.
            </LegalCallout>
          </LegalSection>

          <LegalSection id="third-parties" index={5} icon={<Share2 className="h-4.5 w-4.5" />} title="Who else can see anything">
            <p>
              Two features send data outside your store. Both are off until you turn them on, and both can be
              turned off again.
            </p>
            <DataTable
              columns={["Feature", "Who is involved", "What passes through"]}
              rows={[
                [
                  "Phone app access",
                  "Cloudflare",
                  "A secure connection that lets your phones reach your own store PC from outside the store. Your data stays on that PC."
                ],
                [
                  "Google Sheets export",
                  "Google",
                  "Your daily sales totals, written to a spreadsheet in a Google account you own and control."
                ]
              ]}
            />
            <p>
              We do not sell data, we do not share it with advertisers, and we do not use it to train anything.
              We use no analytics or advertising trackers on this website.
            </p>
          </LegalSection>

          <LegalSection id="mobile" index={6} icon={<Camera className="h-4.5 w-4.5" />} title="The phone app's permissions">
            <p>StoreDesk Mobile asks for two permissions, both only for the job on the shop floor:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-semibold text-[var(--foreground)]">Camera</span> &mdash; to scan a barcode. The
                camera image is processed on the phone. It is not stored and not uploaded.
              </li>
              <li>
                <span className="font-semibold text-[var(--foreground)]">Photos</span> &mdash; only if you pick a
                saved photo of a barcode to look up. The image is read on the phone and not uploaded.
              </li>
            </ul>
            <p>
              The app has no advertising identifier, no third-party analytics and no tracking across apps or
              websites.
            </p>
          </LegalSection>

          <LegalSection id="website" index={7} icon={<Globe className="h-4.5 w-4.5" />} title="This website">
            <p>
              The public pages need no account and set no advertising or analytics cookies. Signing in to the
              admin console or redeeming an enrollment code sets a session cookie so you stay signed in; a
              session lasts {PLANS.offlineSessionHours} hours. The download page reads the current version from
              our downloads site when the page is built, not from your browser.
            </p>
          </LegalSection>

          <LegalSection id="retention" index={8} icon={<Clock className="h-4.5 w-4.5" />} title="How long things are kept">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-semibold text-[var(--foreground)]">Store data</span> is kept on your PC until
                you delete it. Uninstalling StoreDesk keeps it unless you tick &ldquo;Remove store data&rdquo;.
              </li>
              <li>
                <span className="font-semibold text-[var(--foreground)]">Account data</span> is kept while the
                account is open, and the audit log is kept with it.
              </li>
              <li>
                <span className="font-semibold text-[var(--foreground)]">Setup keys</span> expire after{" "}
                {PLANS.setupKeyHours} hours and can be used once.
              </li>
              <li>
                <span className="font-semibold text-[var(--foreground)]">Email</span> you send us is kept in our
                mailbox so we can carry on the conversation.
              </li>
            </ul>
          </LegalSection>

          <LegalSection id="rights" index={9} icon={<UserCheck className="h-4.5 w-4.5" />} title="Your choices">
            <p>
              You can turn off the Google Sheets export and phone access at any time in the desktop app. You can
              ask us for a copy of what your account holds, ask us to correct it, or ask us to close the account
              and delete it. Because your store data never reaches us, the only copy is on your PC, and deleting
              it there deletes it.
            </p>
            <p>
              The{" "}
              <a href={DOCS.home} className="font-semibold text-[#1A63F4] hover:underline">
                user guide
              </a>{" "}
              covers where each of these settings lives.
            </p>
          </LegalSection>

          <LegalSection id="contact" index={10} icon={<Lock className="h-4.5 w-4.5" />} title="Contact">
            <p>
              Privacy questions, data requests or anything unclear on this page:{" "}
              <a href={contactMailto({ subject: "StoreDesk privacy" })} className="font-semibold text-[#1A63F4] hover:underline">
                {SITE.email}
              </a>
              . A person reads it.
            </p>
          </LegalSection>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <LegalContents sections={SECTIONS} />
        </aside>
      </div>
    </MarketingShell>
  );
}
