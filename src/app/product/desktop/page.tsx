import { Screenshot, Section } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";
import { ProductDetail } from "../ProductDetail";
import { PRODUCTS } from "../products";
import { MarginChecker } from "./MarginChecker";

export const metadata = pageMetadata({
  title: "StoreDesk Desktop: the back office on your Windows PC",
  description:
    "Price book, supplier costs, register changes, sales reports, fuel, deals and the Georgia ST-3, on the back-office PC. Works with Verifone Commander.",
  path: "/product/desktop",
  absoluteTitle: true
});

export default function DesktopPage() {
  return (
    <ProductDetail
      product={PRODUCTS.desktop}
      title="StoreDesk Desktop: the back office on your PC"
      aside={
        <Screenshot
          src="/screenshots/desktop-price-book.png"
          alt="StoreDesk Desktop price book for a demo store: departments on the left, items with UPC, department and price, three selected for a batch price update"
          priority
          caption="The price book, in the demo store."
        />
      }
      extra={
        <Section
          id="margin"
          title="The sum it does on every item"
          lede="Shelf price, minus the cheapest cost of one. Try it with an example item."
          tone="white"
        >
          <MarginChecker />
        </Section>
      }
    />
  );
}
