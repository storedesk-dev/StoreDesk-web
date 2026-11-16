import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Terms",
  description: "The terms for StoreDesk Desktop, StoreDesk Mobile, StoreDesk Service and StoreDesk Lottery in your store.",
  path: "/terms"
});

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
