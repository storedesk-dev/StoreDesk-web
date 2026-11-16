import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Privacy",
  description: "What StoreDesk holds, where it is held, and who else can see it. Your store's catalogue, prices and sales stay on the PC in your back office.",
  path: "/privacy"
});

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
