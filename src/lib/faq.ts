import { DOCS_BASE, PLANS, PLAY_STORE_URL, SITE } from "@/lib/site";

/**
 * The questions stores actually ask before they buy, with the answers the product can stand behind.
 *
 * One list, used twice: rendered on the product page, and emitted as `FAQPage` structured data from
 * the same array. Google only shows an FAQ rich result when the question and answer are visible on
 * the page, so the two must not drift — sharing the array is what guarantees that.
 *
 * Every answer here is checked against the code: register writes against Settings › Register writes,
 * the state list against `StateRules.Supported`, the plan limits against the control plane's license
 * defaults. An answer nobody can verify does not belong in a rich result.
 */
export interface FaqEntry {
  question: string;
  /** Plain text: this is what goes into the structured data, so it carries no markup. */
  answer: string;
  /** Where the full answer lives, when there is one. */
  href?: string;
}

export const FAQ: FaqEntry[] = [
  {
    question: "Which registers does StoreDesk work with?",
    answer:
      "Verifone Commander. StoreDesk reads your price book and your sales over the store network using a Commander login you already have. It is not affiliated with Verifone.",
    href: `${DOCS_BASE}/t/flow.connect-register`
  },
  {
    question: "Does StoreDesk change prices on my register?",
    answer:
      "Only if you turn that on, and only when a person sends them. Sending changes back is off by default; when it is on, changes are staged so you can check them, and someone has to press send. Nothing is ever pushed to a till automatically.",
    href: `${DOCS_BASE}/t/settings.registerWrites`
  },
  {
    question: "Does it keep working when the internet goes down?",
    answer:
      "Yes. The register and the back-office PC talk over your own store network, so the price book, the reports, the sales tax working and signing in all keep working with no internet. Phones away from the store, the Google Sheets export and licensing need the line.",
    href: `${DOCS_BASE}/t/dev.sync`
  },
  {
    question: "Where is my sales data kept?",
    answer:
      "On the back-office PC in your store. Your price book, supplier costs, transactions and sales history never reach StoreDesk. The account we hold covers your organisation, your stores, your licence and which PCs are connected.",
    href: "/privacy"
  },
  {
    question: "Which sales tax returns can it prepare?",
    answer:
      "The Georgia ST-3. StoreDesk works the return out from sales data you already have and produces a file you upload to the Georgia Tax Center yourself. It does not file on your behalf, and Georgia is the only state supported today.",
    href: `${DOCS_BASE}/t/page.salesTax`
  },
  {
    question: "What do I need to run it?",
    answer:
      "A Windows 10 or later PC in the back office that can reach your register over the store network, and an Android 5.0 or later phone for the shop floor. There is no iPhone app yet.",
    href: "/download"
  },
  {
    question: "How do staff get the phone app?",
    answer: `From Google Play, like any other app. Each person signs in with an account you create for them, and you choose which screens they can open. There is no public sign-up.`,
    href: PLAY_STORE_URL
  },
  {
    question: "How long does setup take?",
    answer: `About an afternoon. Install on the back-office PC and paste the setup key we email you (keep it: it also sets up a replacement PC), then point StoreDesk at your register and let the price book import.`,
    href: `${DOCS_BASE}/t/flow.install`
  },
  {
    question: "What does StoreDesk cost?",
    answer: `There is a ${PLANS.trialDays}-day trial, then a ${PLANS.standardDays}-day plan. Pricing depends on how many stores you run, so ask us at ${SITE.email} and we will tell you plainly.`,
    href: "/contact"
  }
];

/** The `FAQPage` graph node for the page that renders {@link FAQ}. */
export function faqJsonLd(pageUrl: string) {
  return {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: FAQ.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer }
    }))
  };
}
