import { EnrollClient } from "./EnrollClient";
import { pageMetadata } from "@/lib/metadata";

export const metadata = {
  ...pageMetadata({
    title: "Welcome to StoreDesk",
    description: "Use the code from your welcome e-mail to set your StoreDesk password.",
    path: "/enroll"
  }),
  // A functional page for someone holding a one-time code, not content to rank.
  robots: { index: false, follow: false }
};

export default function EnrollPage() {
  return <EnrollClient />;
}
