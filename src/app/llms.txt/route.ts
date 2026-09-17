import { CAPABILITIES, DOCS_BASE, PLANS, PLAY_STORE_URL, SITE } from "@/lib/site";
import { FAQ } from "@/lib/faq";
import { SITE_URL } from "@/lib/metadata";
import { fetchLatestRelease } from "@/lib/release";

/**
 * /llms.txt — a plain-text brief for language-model crawlers (llmstxt.org).
 *
 * Built from the same constants as the site so it cannot drift from the pages:
 * when a plan limit or a capability changes in `@/lib/site`, this changes too.
 */
/** Re-rendered hourly so the version below is the one actually published. */
export const revalidate = 3600;

export async function GET() {
  const release = await fetchLatestRelease();
  const body = `# ${SITE.name}

> ${SITE.summary}

${SITE.name} is back-office software for independent convenience stores and gas stations that use a Verifone Commander register. It is local-first: the store's catalogue, supplier costs and sales history live on the back-office PC, not in the cloud.

## Key facts

- Platforms: Windows 10 or later (desktop app plus a background service on the back-office PC); Android 5.0 or later, installed from Google Play. There is no iPhone app.
- Register: Verifone Commander, read over the store network. Writing back is a separate setting (off by default); when it is on, changes are staged and sent by a person, never automatically.
- Data location: the price book, supplier costs and sales reports stay on the store PC. The ${SITE.name} account holds only the organisation, its stores, licensing and which PCs are connected.
- Offline: the register, the desktop app and staff sign-in all keep working with no internet, because passwords are checked on the store PC; a session lasts ${PLANS.offlineSessionHours} hours. Phones away from the store, the Google Sheet export and the ${SITE.name} account need the line.
- Setup: a setup key is emailed when a store is created; it does not expire, sets up the store's PC again or a replacement PC (which takes over), and StoreDesk can rotate it.
- Plans: a ${PLANS.trialDays}-day trial, then a ${PLANS.standardDays}-day standard plan. An organisation license covers up to ${PLANS.defaultMaxStores} stores with ${PLANS.defaultMaxWorkers} store PC each by default, and a single store can also have its own license. Pricing is by enquiry.
- Contact: ${SITE.email}
- Documentation: ${DOCS_BASE}${release ? `
- Current version: ${release.version}${release.channel === "beta" ? " (beta)" : ""}, published ${release.releaseDate.slice(0, 10)}. Release notes: ${release.notesUrl}
- Windows installer: ${release.windows?.url ?? "see the download page"}
- Android: ${PLAY_STORE_URL}` : ""}

## Features

${Object.values(CAPABILITIES)
  .map((line) => `- ${line}`)
  .join("\n")}

## Who it is for

Independent convenience stores and gas stations, typically one to five sites, already running a
Verifone Commander. The people who use it are the owner, a manager doing the price book and the
sales tax return, and staff on the shop floor with a phone.

## What it replaces

Paper register reports and fuel readings copied into a spreadsheet by hand and reconciled against
the printout; price changes made one PLU at a time through the Commander's own interface; and a
sales tax return worked out from those retyped numbers.

## Questions and answers

${FAQ.map((entry) => `**${entry.question}**\n${entry.answer}`).join("\n\n")}

## Not available yet

- EDI, so invoices from H.T. Hackney and other distributors that support it become costs without typing, is planned and not shipped.
- A lottery module for settling the daily ticket count is planned and not shipped.
- There is no iPhone app, and the background service is Windows-only.
- Sales tax returns cover Georgia (ST-3) only.

## Pages

- [What it does](${SITE_URL}/product): the price book, supplier cost comparison, floor scanning, register sales reports, Georgia ST-3 sales tax and Google Sheets export.
- [How it works](${SITE_URL}/how-it-works): the four setup stages and what keeps working when the internet goes down.
- [About](${SITE_URL}/about): why ${SITE.name} exists, and what is planned.
- [Download](${SITE_URL}/download): the Windows installer and the Android app.
- [Contact](${SITE_URL}/contact): email the team for setup keys, support or questions.

## Documentation

- [User guide](${DOCS_BASE}): every desktop screen, every phone screen and the store PC service, with screenshots.
- [Install](${DOCS_BASE}/t/flow.install), [connect the register](${DOCS_BASE}/t/flow.connect-register), [set up the phone app](${DOCS_BASE}/t/flow.mobile).
- [Troubleshooting](${DOCS_BASE}/t/service.troubleshooting) and [release notes](${DOCS_BASE}/t/release.latest).

## Optional

- [Privacy](${SITE_URL}/privacy)
- [Terms](${SITE_URL}/terms)
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
