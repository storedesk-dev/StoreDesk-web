import { EnrollClient } from "./EnrollClient";
import { pageMetadata } from "@/lib/metadata";

export const metadata = {
  ...pageMetadata({
    title: "Finish setting up your account",
    description: "Use the enrollment code you were sent to choose your StoreDesk password.",
    path: "/enroll"
  }),
  // A functional page for someone holding a one-time code, not content to rank.
  robots: { index: false, follow: false }
};

export default function EnrollPage() {
  return <EnrollClient />;
}
