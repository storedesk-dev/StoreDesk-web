import { ProductClient } from "./ProductClient";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "What StoreDesk does",
  description:
    "Price book, supplier cost comparison, floor scanning, sales reports from the register, Georgia ST-3 sales tax and Google Sheets export — on the PC in your back office.",
  path: "/product"
});

export default function ProductPage() {
  return <ProductClient />;
}
