import { ProductClient } from "./ProductClient";
import { pageMetadata, SITE_URL } from "@/lib/metadata";
import { faqJsonLd } from "@/lib/faq";
import { jsonLdScript } from "@/lib/json-ld";

export const metadata = pageMetadata({
  title: "What StoreDesk does",
  description:
    "Price book, supplier cost comparison, fuel, deals, floor scanning, sales reports from the register, Georgia ST-3 sales tax and Google Sheets export, on the PC in your back office.",
  path: "/product"
});

const PAGE_URL = `${SITE_URL}/product`;

/**
 * The FAQ is emitted as structured data from the same array the page renders, so the two cannot
 * drift. Google only shows an FAQ rich result when the question and answer are visible on the page,
 * which is why the section below is real content rather than markup alone.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    faqJsonLd(PAGE_URL),
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "StoreDesk", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "What it does", item: PAGE_URL }
      ]
    }
  ]
};

export default function ProductPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <ProductClient />
    </>
  );
}
