import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Price Book, cost analysis, invoice review, POS reports, and StoreDesk Mobile — Worker on your backoffice PC with Verifone Commander."
};

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
