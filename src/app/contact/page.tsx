import { PageFrame, PageHero, Section } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";
import { DOCS, SITE, contactMailto } from "@/lib/site";
import { Composer } from "./ContactClient";

export const metadata = pageMetadata({
  title: "Contact StoreDesk",
  description:
    "Ask whether StoreDesk fits your store, get a setup key, or get help once you are running. A person who works on StoreDesk reads every email.",
  path: "/contact",
  absoluteTitle: true
});

/** Most questions already have a page in the guide, with screenshots. */
const FIRST_STOPS = [
  { href: DOCS.troubleshooting, title: "Something is not working", body: "The service will not start, the register will not answer, phones cannot reach the store." },
  { href: DOCS.install, title: "Installing or setting up", body: "Every step of a first setup, with a screenshot of each screen." },
  { href: DOCS.home, title: "How a screen works", body: "Every desktop and phone screen, one by one." }
];

const NOTES = [
  { title: "A person reads it", body: "Whoever replies has worked on StoreDesk." },
  { title: "Send a photo", body: "If a screen showed an error, a phone photo of it saves a round trip." },
  { title: "Say which app", body: "Desktop, Mobile, Service or Lottery, and roughly when it started." }
];

export default function ContactPage() {
  return (
    <PageFrame>
      <PageHero
        title="Talk to the people who build StoreDesk"
        lede="Pick what it is about and we start the email for you, with the details we would otherwise ask for."
        aside={<Composer />}
      >
        <p className="mt-6 text-[17px]">
          Or write in your own words:{" "}
          <a href={contactMailto()} className="sd-link break-all">
            {SITE.email}
          </a>
        </p>
        <dl className="mt-8 space-y-4">
          {NOTES.map((note) => (
            <div key={note.title}>
              <dt className="text-[17px] font-bold">{note.title}</dt>
              <dd className="text-[16px] text-[var(--muted)]">{note.body}</dd>
            </div>
          ))}
        </dl>
      </PageHero>

      <Section title="The guide may answer it faster" tone="wash">
        <ul className="grid gap-x-10 gap-y-6 md:grid-cols-3">
          {FIRST_STOPS.map((stop) => (
            <li key={stop.href} className="border-t border-[var(--line-strong)] pt-4">
              <a href={stop.href} className="sd-link inline-flex min-h-11 items-center text-[18px]">
                {stop.title}
              </a>
              <p className="mt-1 text-[16px] text-[var(--muted)]">{stop.body}</p>
            </li>
          ))}
        </ul>
      </Section>
    </PageFrame>
  );
}
