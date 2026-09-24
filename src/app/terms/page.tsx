import { MarketingShell } from "@/components/MarketingShell";
import { LegalCallout, LegalContents, LegalSection } from "@/components/LegalPage";
import { AlertTriangle, Building2, Calculator, Database, Download, FileText, Handshake, LifeBuoy, PackageCheck, Plug, Scale, ShieldCheck, XCircle } from "lucide-react";
import { DOCS, PLANS, SITE, contactMailto } from "@/lib/site";

/**
 * The terms, written against what the software actually does.
 *
 * The previous version was three short paragraphs and said store data is "not shared with third
 * parties", which stopped being true the moment a store switched on the Google Sheets export or let
 * phones in through the tunnel. It also said nothing about the licence, about who is responsible when
 * a price is sent to a register, or about the unsigned installer.
 */

const UPDATED = "16 September 2026";

const SECTIONS = [
  { id: "who", title: "Who this is between" },
  { id: "what", title: "What StoreDesk is, and is not" },
  { id: "licence", title: "Your licence" },
  { id: "your-side", title: "What you look after" },
  { id: "register", title: "The register connection" },
  { id: "writes", title: "Sending changes to the register" },
  { id: "tax", title: "Sales tax returns" },
  { id: "data", title: "Your data" },
  { id: "updates", title: "Updates and the unsigned installer" },
  { id: "availability", title: "Availability and support" },
  { id: "liability", title: "Warranty and liability" },
  { id: "ending", title: "Ending it" },
  { id: "changes", title: "Changes to these terms" }
];

export default function TermsPage() {
  return (
    <MarketingShell
      eyebrow="Legal"
      title="Terms"
      lede={`The agreement between your business and StoreDesk. Last updated ${UPDATED}.`}
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="max-w-3xl space-y-8">
          <LegalSection id="who" index={1} icon={<Handshake className="h-4.5 w-4.5" />} title="Who this is between">
            <p>
              These terms are between StoreDesk and the business that licenses it. Installing StoreDesk, or
              using it, means agreeing to them. If you are agreeing on behalf of a company, you are confirming
              you may do so.
            </p>
          </LegalSection>

          <LegalSection id="what" index={2} icon={<PackageCheck className="h-4.5 w-4.5" />} title="What StoreDesk is, and is not">
            <p>
              StoreDesk is back-office software for convenience stores and gas stations running a Verifone
              Commander. It reads your price book and sales from the register, records what you pay your
              suppliers, works out margin, tracks fuel prices and deals, prepares a Georgia ST-3 sales tax
              return, and gives your staff a phone app for the shop floor.
            </p>
            <p>It is not any of these, and is not sold as any of them:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>a point of sale &mdash; sales are rung up on your register, not in StoreDesk;</li>
              <li>an inventory system &mdash; it does not track stock on hand or reorder levels;</li>
              <li>an accounting package, and it does not file anything with any tax authority for you;</li>
              <li>a payment system &mdash; it never touches card processing or the pumps.</li>
            </ul>
          </LegalSection>

          <LegalSection id="licence" index={3} icon={<FileText className="h-4.5 w-4.5" />} title="Your licence">
            <p>
              While your plan is current, you may install and use StoreDesk in the store your licence covers.
              A licence begins with a {PLANS.trialDays}-day trial and then runs as a {PLANS.standardDays}-day
              plan, and covers one store with {PLANS.defaultMaxWorkers} store PC. A business with several
              stores holds a licence for each. Any different limits are whatever we have agreed with you in
              writing.
            </p>
            <p>
              StoreDesk does not charge for the software today, so there is nothing to pay, cancel or refund. If
              that ever changes, we will tell you the price and give you notice before anything is charged, and
              you will be free to stop using StoreDesk instead.
            </p>
            <p>
              The licence is for running the software in your own stores. It does not include reselling it,
              hosting it for other businesses, or taking it apart to build a competing product.
            </p>
          </LegalSection>

          <LegalSection id="your-side" index={4} icon={<Building2 className="h-4.5 w-4.5" />} title="What you look after">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>The back-office PC: that it runs a supported Windows, stays on, and is backed up.</li>
              <li>
                Your network: that the PC can reach the register, and that outbound HTTPS is allowed for
                licensing and for phone access.
              </li>
              <li>
                Accounts: who you create, what screens you give them, and removing people when they leave.
              </li>
              <li>
                Your setup key: it works until a PC is set up with it, and StoreDesk then makes the next one.
                An organization admin can read the current key any time. Treat it like a password.
              </li>
              <li>The accuracy of what you type in, in particular supplier costs and sales tax settings.</li>
            </ul>
          </LegalSection>

          <LegalSection id="register" index={5} icon={<Plug className="h-4.5 w-4.5" />} title="The register connection">
            <p>
              StoreDesk connects to your Commander with credentials you provide, over your own store network.
              You are responsible for having the right to use those credentials and for keeping that use within
              Verifone&rsquo;s terms and your own network policy. StoreDesk is not affiliated with Verifone;
              Verifone and Commander are their trademarks.
            </p>
          </LegalSection>

          <LegalSection id="writes" index={6} icon={<AlertTriangle className="h-4.5 w-4.5" />} title="Sending changes to the register">
            <p>
              StoreDesk can send price and cost changes back to the register. This is off by default. When it is
              turned on, changes are staged, previewed and sent by a person, up to 50 items at a time; nothing is
              ever sent automatically.
            </p>
            <LegalCallout tone="warn">
              A sent change becomes a price your customers pay, so what you send is your decision and your
              responsibility. Check a staged change before you send it.
            </LegalCallout>
            <p>
              The{" "}
              <a href={DOCS.topic("settings.registerWrites")} className="font-semibold text-[#1A63F4] hover:underline">
                user guide
              </a>{" "}
              explains the settings and the preview.
            </p>
          </LegalSection>

          <LegalSection id="tax" index={7} icon={<Calculator className="h-4.5 w-4.5" />} title="Sales tax returns">
            <p>
              StoreDesk prepares a Georgia ST-3 return from your own sales data and produces a file you can
              upload yourself. It does not file on your behalf, and only Georgia is supported today.
            </p>
            <LegalCallout tone="warn">
              A return is only as right as the sales data and the settings behind it. Check it before you file.
              StoreDesk is not a tax adviser, and nothing it produces is tax advice.
            </LegalCallout>
          </LegalSection>

          <LegalSection id="data" index={8} icon={<Database className="h-4.5 w-4.5" />} title="Your data">
            <p>
              Your price book, costs, sales history and tax working stay on your store PC and belong to you. We
              cannot read them. What we hold is your account, and the{" "}
              <a href="/privacy" className="font-semibold text-[#1A63F4] hover:underline">
                privacy page
              </a>{" "}
              lists it line by line.
            </p>
            <p>
              Two optional features send data outside your store, and only if you turn them on: phone access,
              which passes through Cloudflare, and the daily sales export, which writes to a Google spreadsheet
              you own. Using those means accepting how those companies handle what passes through them.
            </p>
          </LegalSection>

          <LegalSection id="updates" index={9} icon={<Download className="h-4.5 w-4.5" />} title="Updates and the unsigned installer">
            <p>
              StoreDesk updates from our downloads site. Updates may change or remove features; anything that
              changes how you work will be in the release notes.
            </p>
            <p>
              The installer is not signed with a paid code-signing certificate, so Windows will warn you the
              first time. We publish a SHA-256 for every file beside the download and in the release notes so you
              can check what you have. Only install StoreDesk from our own downloads site.
            </p>
          </LegalSection>

          <LegalSection id="availability" index={10} icon={<LifeBuoy className="h-4.5 w-4.5" />} title="Availability and support">
            <p>
              StoreDesk runs on your PC, so it keeps working whether or not our servers do. Licensing checks,
              phone access from outside the store and the Sheets export need the internet, and those we do not
              promise to keep running without interruption.
            </p>
            <p>
              Support is by email, from the people who built it. There is no guaranteed response time unless we
              have agreed one with you in writing.
            </p>
          </LegalSection>

          <LegalSection id="liability" index={11} icon={<Scale className="h-4.5 w-4.5" />} title="Warranty and liability">
            <p>
              StoreDesk is provided as it is. We do not warrant that it will be uninterrupted or error-free, or
              that every number it shows will be correct: it reports on data read from your register and typed in
              by you.
            </p>
            <p>
              To the extent the law allows, StoreDesk is not liable for lost profit, lost sales, lost data, or
              indirect or consequential loss; and our total liability for any claim is limited to the fees you
              paid in the twelve months before it. Nothing here limits liability that cannot be limited by law.
            </p>
          </LegalSection>

          <LegalSection id="ending" index={12} icon={<XCircle className="h-4.5 w-4.5" />} title="Ending it">
            <p>
              You can stop using StoreDesk at any time and uninstall it; your data stays on your PC unless you
              choose to remove it. We may suspend or end a licence that is unpaid, or that is being used outside
              these terms, and we will tell you why.
            </p>
            <p>
              When a licence ends, the software stops being licensed to you. Your store data is still yours and
              still on your PC.
            </p>
          </LegalSection>

          <LegalSection id="changes" index={13} icon={<ShieldCheck className="h-4.5 w-4.5" />} title="Changes to these terms">
            <p>
              We will update this page when the product or the agreement changes, and the date at the top will
              say when. Anything that materially affects you we will also tell you about by email.
            </p>
            <p>
              Questions:{" "}
              <a href={contactMailto({ subject: "StoreDesk terms" })} className="font-semibold text-[#1A63F4] hover:underline">
                {SITE.email}
              </a>
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
