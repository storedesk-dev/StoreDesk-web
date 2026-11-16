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

## Products

- StoreDesk Desktop: the back-office app on the store's Windows PC. Price book, supplier costs, register changes, sales reports and transactions, Fuel Center, deals, Georgia ST-3 sales tax, Google Sheet export, users and roles.
- StoreDesk Mobile: the Android phone app. Scan a barcode for price, cost and margin; price book; today's sales and analytics; transactions; fuel prices; deals; reports.
- StoreDesk Service: the background program on the store PC. Holds the store's data, talks to the Verifone Commander, checks sign-ins offline, and serves the desktop and phone apps.
- StoreDesk Lottery: a separate Windows app with its own installer and database, for the instant-ticket rack at the lottery counter. Runs with or without StoreDesk.

## Key facts

- Platforms: StoreDesk Desktop and StoreDesk Service run on Windows 10 or later, on the back-office PC, from one installer. StoreDesk Mobile runs on Android 5.0 or later, from Google Play; the iPhone app is not released yet. StoreDesk Lottery is its own Windows app on the lottery counter PC.
- Register: Verifone Commander, read over the store network. An item change (price, details or a new item) goes to the register only when a person sends it; StoreDesk checks the item first and reads it back. Deals and fuel prices are not sent to the register yet. Nothing is ever sent automatically.
- Data location: the price book, supplier costs and sales reports stay on the store PC. The ${SITE.name} account holds only your stores, their licensing and which PCs are connected.
- Offline: the register, the desktop app and staff sign-in all keep working with no internet, because passwords are checked on the store PC; a session lasts ${PLANS.offlineSessionHours} hours. Phones away from the store, the Google Sheet export and the ${SITE.name} account need the line.
- Setup: a setup key is emailed when a store is created; it does not expire but is used once, and StoreDesk makes the next one as it is used. An admin reads the current key on the store PC to set up a replacement PC (which takes over); StoreDesk can also rotate it.
- Licensing: a license covers one store with ${PLANS.defaultMaxWorkers} store PC, for a term agreed with ${SITE.name}; a business with several stores holds a license for each. There is no organisation-wide or multi-store licence. Licenses are granted by ${SITE.name}, not bought online, so a new store is unlicensed until one is granted. Pricing is by enquiry.
- Contact: ${SITE.email}
- Documentation: ${DOCS_BASE}${release ? `
- Current version: ${release.version}${release.channel === "beta" ? " (beta)" : ""}, published ${release.releaseDate.slice(0, 10)}. Release notes: ${release.notesUrl}
- Windows installer: ${release.windows?.url ?? "see the download page"}
- Android: ${PLAY_STORE_URL}` : ""}

## Features

${Object.values(CAPABILITIES)
  .map((line) => `- ${line}`)
  .join("\n")}

## StoreDesk Lottery

- The rack: every box, what is in it, and how far through each pack is.
- Receive packs by scanner, put a pack out, hold, move, take off or return a pack; packs listed by state with a history of every change.
- Close a shift by scanning the ticket showing in each box, then typing three numbers from the lottery terminal. Lottery cash = instant sales - instant cashes + online sales - online cashes.
- Correct a closed day: each correction is a new version with a reason, kept in an audit trail.
- Settle the packs that are due (21 days after activation in Georgia).
- Shift report with Print, a daily report, best sellers, rack advice and what to order.
- Rack setup to match the counter; people and roles with the same sign-in as StoreDesk; a demo store with sample data.
- Georgia Lottery instant tickets today.
- With StoreDesk, each closed day's lottery totals go to StoreDesk Service. Packs, games and names stay on the lottery PC.

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
- StoreDesk Lottery does not email reports yet (coming soon), does not import the Georgia settlement statement, has no phone screens, and keeps no lottery data in the cloud.
- Deal and fuel price changes are not sent to the register yet; change them on the register.
- The iPhone app is not released yet, and StoreDesk Service is Windows-only.
- Sales tax returns cover Georgia (ST-3) only.

## Pages

- [Product overview](${SITE_URL}/product): the four apps, what StoreDesk reads from and sends to the register, what works with the internet down, and the common questions.
- [StoreDesk Desktop](${SITE_URL}/product/desktop): the back-office app on the Windows PC: what it does, who uses it, what it needs, what is not built yet.
- [StoreDesk Mobile](${SITE_URL}/product/mobile): the Android app: scanning, price book, sales, and how it reaches the store.
- [StoreDesk Service](${SITE_URL}/product/service): the background program on the store PC that keeps the data and talks to the register.
- [StoreDesk Lottery](${SITE_URL}/product/lottery): the rack, the shift close by scanner, reports, and how it works with StoreDesk.
- [How it works](${SITE_URL}/how-it-works): the four setup stages and what keeps working when the internet goes down.
- [About](${SITE_URL}/about): why ${SITE.name} exists, and what is planned.
- [Download](${SITE_URL}/download): the Windows installer (StoreDesk Desktop and Service) and StoreDesk Mobile for Android.
- [Contact](${SITE_URL}/contact): email the team for setup keys, support or questions.

## Documentation

- [User guide](${DOCS_BASE}): every StoreDesk Desktop, Mobile and Lottery screen, and StoreDesk Service, with screenshots.
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
