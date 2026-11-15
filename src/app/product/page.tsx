import { ProductClient } from "./ProductClient";
import { pageMetadata, SITE_URL } from "@/lib/metadata";
import { faqJsonLd } from "@/lib/faq";
import { jsonLdScript } from "@/lib/json-ld";

export const metadata = pageMetadata({
  title: "Product: Desktop, Mobile, Service and Lottery",
  description:
    "What StoreDesk Desktop, Mobile, Service and Lottery each do, who uses them, what they need and what is coming.",
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
        { "@type": "ListItem", position: 2, name: "Product", item: PAGE_URL }
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
