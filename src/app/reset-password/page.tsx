import { ResetPasswordClient } from "./ResetPasswordClient";
import { pageMetadata } from "@/lib/metadata";

export const metadata = {
  ...pageMetadata({
    title: "Reset your password",
    description: "Use the code you were sent to choose a new StoreDesk password.",
    path: "/reset-password"
  }),
  // A functional page for someone holding a one-time code, not content to rank.
  robots: { index: false, follow: false }
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}
