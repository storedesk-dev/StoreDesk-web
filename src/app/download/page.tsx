import Link from "next/link";
import { PageFrame, PageHero, Section } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";
import { fetchLatestRelease, formatReleaseDate } from "@/lib/release";
import { DOCS, contactMailto } from "@/lib/site";
import { CopyHash, Installers } from "./DownloadClient";

export const metadata = pageMetadata({
  title: "Download StoreDesk for Windows and Android",
  description:
    "StoreDesk Desktop and Service for Windows, and StoreDesk Mobile for Android. Install on the back-office PC first, then add the phone app.",
  path: "/download",
  absoluteTitle: true
});

/** Re-read hourly, with the release itself (lib/release.ts caches the fetch for an hour). */
export const revalidate = 3600;

const BEFORE = [
  {
    title: "A setup key",
    body: "We email it when we set up your store. It works until it is used; StoreDesk then makes the next one, which an admin can read on the store PC.",
    action: { href: contactMailto({ subject: "StoreDesk setup key" }), label: "Ask for a setup key" }
  },
  {
    title: "The back-office PC",
    body: "The Windows PC that can reach your register over the store network. Not a till.",
    action: null
  },
  {
    title: "Phones last",
    body: "Install StoreDesk Mobile once the store PC is connected. Each person signs in with their own account.",
    action: null
  }
];

/**
 * The download page, in the order the questions come up: which file, what to have ready, what
 * Windows will say, where the help is. The version, size and SHA-256 come from the release the
 * downloads site is actually serving, read on the server.
 */
export default async function DownloadPage() {
  const release = await fetchLatestRelease();
  const published = release ? formatReleaseDate(release.releaseDate) : null;
  const file = release?.windows ?? null;
  const hash = file?.sha256.toUpperCase() ?? null;

  return (
    <PageFrame>
      <PageHero
        title="Install on the back-office PC first"
        lede="The Windows installer sets up StoreDesk and keeps your store's data. Add the phone app once the store is connected."
        aside={<Installers release={release} />}
      >
        {release ? (
          <p className="sd-num mt-6 text-[16px] text-[var(--muted)]">
            <span className="font-bold text-[var(--ink)]">Version {release.version}</span>
            {release.channel === "beta" ? " (beta)" : ""}
            {published ? `, ${published}` : ""}.{" "}
            <a href={release.notesUrl} className="sd-link">
              What&rsquo;s new
            </a>
          </p>
        ) : null}
      </PageHero>

      <Section title="Have these ready" tone="wash">
        <dl className="grid gap-x-10 gap-y-8 md:grid-cols-3">
          {BEFORE.map((item) => (
            <div key={item.title} className="border-t border-[var(--line-strong)] pt-4">
              <dt className="sd-h3">{item.title}</dt>
              <dd className="mt-2 text-[17px] leading-relaxed text-[var(--muted)]">
                {item.body}
                {item.action ? (
                  <>
                    {" "}
                    <a href={item.action.href} className="sd-link">
                      {item.action.label}
                    </a>
                  </>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Windows will warn you the first time" tone="white" width="narrow">
        <p className="max-w-2xl text-[17px] leading-relaxed">
          The installer is not signed with a paid certificate yet, so Windows says it protected your PC. Choose{" "}
          <strong>More info</strong>, then <strong>Run anyway</strong>.
        </p>
        {hash ? (
          <details className="mt-6 max-w-2xl rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--wash)] px-5 py-3">
            <summary className="min-h-11 cursor-pointer content-center text-[16px] font-bold">Check the file you downloaded</summary>
            <div className="mt-2 space-y-3 pb-2 text-[15px]">
              <p className="text-[var(--muted)]">
                Compare this with the SHA-256 in the release notes. In PowerShell, where you saved it:{" "}
                <code className="font-mono">Get-FileHash .\{file?.name}</code>
              </p>
              <div className="flex items-start gap-2">
                <code className="sd-num min-w-0 flex-1 break-all rounded-[var(--radius-sm)] bg-white px-3 py-2 font-mono text-[13px]">{hash}</code>
                <CopyHash value={hash} />
              </div>
            </div>
          </details>
        ) : null}
      </Section>

      <Section title="Help, and the other downloads" tone="wash">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
          <div className="border-t border-[var(--line-strong)] pt-4">
            <h3 className="sd-h3">The guide</h3>
            <ul className="mt-3 space-y-1 text-[17px]">
              <li>
                <a href={DOCS.install} className="sd-link inline-flex min-h-11 items-center">
                  Setup guide, step by step
                </a>
              </li>
              <li>
                <a href={DOCS.troubleshooting} className="sd-link inline-flex min-h-11 items-center">
                  If the service or register will not start
                </a>
              </li>
              <li>
                <a href={DOCS.releaseNotes} className="sd-link inline-flex min-h-11 items-center">
                  What changed in each version
                </a>
              </li>
            </ul>
          </div>
          <div className="border-t border-[var(--line-strong)] pt-4">
            <h3 className="sd-h3">StoreDesk Lottery</h3>
            <p className="mt-3 text-[17px] leading-relaxed text-[var(--muted)]">
              Its own installer, for the PC at the lottery counter.{" "}
              <a href={contactMailto({ subject: "StoreDesk Lottery installer" })} className="sd-link">
                Ask us for it
              </a>
              . <Link href="/product/lottery" className="sd-link">What it does</Link>
            </p>
          </div>
          <div className="border-t border-[var(--line-strong)] pt-4">
            <h3 className="sd-h3">iPhone, Mac and Linux</h3>
            <p className="mt-3 text-[17px] leading-relaxed text-[var(--muted)]">
              The iPhone app is not released yet. StoreDesk Service runs on Windows only.
            </p>
          </div>
        </div>
      </Section>
    </PageFrame>
  );
}
