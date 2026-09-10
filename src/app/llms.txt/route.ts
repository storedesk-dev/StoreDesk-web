import { CAPABILITIES, PLANS, SITE } from "@/lib/site";
import { SITE_URL } from "@/lib/metadata";

/**
 * /llms.txt — a plain-text brief for language-model crawlers (llmstxt.org).
 *
 * Built from the same constants as the site so it cannot drift from the pages:
 * when a plan limit or a capability changes in `@/lib/site`, this changes too.
 */
export const dynamic = "force-static";

export function GET() {
  const body = `# ${SITE.name}

> ${SITE.summary}

${SITE.name} is back-office software for independent convenience stores and gas stations that use a Verifone Commander register. It is local-first: the store's catalogue, supplier costs and sales history live on the back-office PC, not in the cloud.

## Key facts

- Platforms: Windows 10 or later (desktop app plus a background service on the back-office PC); Android 5.0 or later (phone app). There is no iPhone app.
- Register: Verifone Commander, read over the store network. ${SITE.name} never writes prices or settings back to the register.
- Data location: the price book, supplier costs and sales reports stay on the store PC. The ${SITE.name} account holds only the organisation, its stores, licensing and which PCs are connected.
- Offline: staff who are already signed in keep working for ${PLANS.offlineSessionHours} hours with no internet connection.
- Setup: a setup key is emailed when a store is created; it is valid for ${PLANS.setupKeyHours} hours and works once.
- Plans: a ${PLANS.trialDays}-day trial, then a ${PLANS.standardDays}-day standard plan. An organisation can run up to ${PLANS.defaultMaxStores} stores and ${PLANS.defaultMaxWorkers} store PCs by default. Pricing is by enquiry.
- Contact: ${SITE.email}

## Features

${Object.values(CAPABILITIES)
  .map((line) => `- ${line}`)
  .join("\n")}

## Not available yet

- Lottery settlement and supplier invoice upload are planned, not shipped.
- Price changes are made on the register, not pushed from ${SITE.name}.

## Pages

- [What it does](${SITE_URL}/product): the price book, supplier cost comparison, floor scanning, register sales reports, Georgia ST-3 sales tax and Google Sheets export.
- [How it works](${SITE_URL}/how-it-works): the four setup steps and what keeps working when the internet goes down.
- [About](${SITE_URL}/about): why ${SITE.name} exists and where each kind of data is kept.
- [Download](${SITE_URL}/download): the Windows installer and the Android app.
- [Contact](${SITE_URL}/contact): email the team for setup keys, support or questions.

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
