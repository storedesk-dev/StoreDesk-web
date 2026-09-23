import { VerifyClient } from "./VerifyClient";
import { pageMetadata } from "@/lib/metadata";

export const metadata = {
  ...pageMetadata({
    title: "Confirm your e-mail address",
    description: "Confirm the e-mail address your StoreDesk account uses.",
    path: "/verify"
  }),
  // A functional page for someone holding a one-time code, not content to rank.
  robots: { index: false, follow: false }
};

export default function VerifyPage() {
  return <VerifyClient />;
}
