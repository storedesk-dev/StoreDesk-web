import { ContactClient } from "./ContactClient";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Contact",
  description:
    "Talk to the people who built StoreDesk — questions before you start, or help once you are running.",
  path: "/contact"
});

export default function ContactPage() {
  return <ContactClient />;
}
