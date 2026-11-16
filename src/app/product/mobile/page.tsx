import { PhoneShot } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";
import { ProductDetail } from "../ProductDetail";
import { PRODUCTS } from "../products";

export const metadata = pageMetadata({
  title: "StoreDesk Mobile: prices, sales and scanning on Android",
  description:
    "Scan a shelf tag for price, cost and margin. Search the price book and see today's sales from the register. Android 5.0 or later, from Google Play.",
  path: "/product/mobile",
  absoluteTitle: true
});

export default function MobilePage() {
  return (
    <ProductDetail
      product={PRODUCTS.mobile}
      title="StoreDesk Mobile: your store on an Android phone"
      aside={
        // Two real screens side by side, the second set lower, so they read as two phones.
        <div className="sd-glow mx-auto grid max-w-[480px] grid-cols-2 gap-4 sm:gap-6">
          <PhoneShot
            src="/screenshots/phone-dashboard.webp"
            alt="StoreDesk Mobile dashboard for the demo store: today's sales, inside and fuel sales, sales tax and cash expected"
            sizes="(min-width: 640px) 230px, 45vw"
            priority
          />
          <PhoneShot
            src="/screenshots/phone-analytics.webp"
            alt="StoreDesk Mobile analytics: sales for the last 7 days compared with the 7 days before, with a sales trend by day"
            sizes="(min-width: 640px) 230px, 45vw"
            className="mt-10"
          />
        </div>
      }
    />
  );
}
