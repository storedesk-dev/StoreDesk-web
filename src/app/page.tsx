import type { Metadata } from "next";
import { LandingPage } from "@/components/LandingPage";

export const metadata: Metadata = {
  title: {
    absolute: "StoreDesk — Worker, Desktop & Mobile for c-stores"
  },
  description:
    "Run StoreDesk Worker on your backoffice PC with Desktop and Mobile. Price Book, Cost Analysis, POS Reports, and invoice review. Works with Verifone Commander."
};

export default function HomePage() {
  return <LandingPage />;
}
