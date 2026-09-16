import type { ReactNode } from "react";

/**
 * Furniture for the privacy and terms pages.
 *
 * A legal page still has to be read, so these exist to break a long document into things the eye can
 * land on: numbered sections with an icon, a panel for the claims worth pulling out, and a table that
 * does not look like prose. The alternative — one column of paragraphs — is what these pages were, and
 * nobody got past the first screen.
 */

export function LegalSection({
  id,
  index,
  title,
  icon,
  children
}: {
  id: string;
  index: number;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1A63F4]/10 text-[#1A63F4]">
          {icon ?? <span className="sd-num text-[14px] font-bold">{index}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[21px] font-bold tracking-tight text-[var(--foreground)]">
            <a href={`#${id}`} className="hover:text-[#1A63F4]">
              {title}
            </a>
          </h2>
          <div className="mt-3 space-y-4 text-[16.5px] leading-[1.7] text-[var(--muted)]">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** The claims worth stating on their own, above the detail that backs them up. */
export function LegalHighlights({ items }: { items: Array<{ value: string; label: string; tone?: "good" | "plain" }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-2xl border p-5 ${
            item.tone === "good" ? "border-[#00A87B]/30 bg-[#00A87B]/[0.06]" : "border-[var(--border)] bg-white"
          }`}
        >
          <p className={`text-[28px] font-bold tracking-tight ${item.tone === "good" ? "text-[#00875F]" : "text-[var(--foreground)]"}`}>
            {item.value}
          </p>
          <p className="mt-1 text-[14.5px] leading-snug text-[var(--muted)]">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

/** Two sides of a boundary, shown side by side: what is here, and what is over there. */
export function LegalSplit({
  left,
  right
}: {
  left: { title: string; note: string; icon: ReactNode; items: string[] };
  right: { title: string; note: string; icon: ReactNode; items: string[] };
}) {
  const panel = (side: typeof left, tone: "green" | "blue") => (
    <div
      className={`rounded-3xl border p-6 ${
        tone === "green" ? "border-[#00A87B]/25 bg-[#00A87B]/[0.05]" : "border-[#1A63F4]/25 bg-[#1A63F4]/[0.04]"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          tone === "green" ? "bg-[#00A87B]/15 text-[#00875F]" : "bg-[#1A63F4]/12 text-[#1A63F4]"
        }`}
      >
        {side.icon}
      </span>
      <p className="mt-4 text-[17px] font-bold tracking-tight text-[var(--foreground)]">{side.title}</p>
      <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--muted)]">{side.note}</p>
      <ul className="mt-4 space-y-2">
        {side.items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[15.5px] text-[#344054]">
            <span className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${tone === "green" ? "bg-[#00A87B]" : "bg-[#1A63F4]"}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {panel(left, "green")}
      {panel(right, "blue")}
    </div>
  );
}

/** A point that should not be skimmed past. */
export function LegalCallout({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border-l-4 px-5 py-4 text-[16px] leading-relaxed ${
        tone === "warn"
          ? "border-l-[#B54708] bg-[#FFFCF5] text-[#344054]"
          : "border-l-[#1A63F4] bg-[#F5F8FF] text-[#344054]"
      }`}
    >
      {children}
    </div>
  );
}

/** A table of contents built from the sections below it, so a long page is navigable. */
export function LegalContents({ sections }: { sections: Array<{ id: string; title: string }> }) {
  return (
    <nav aria-label="On this page" className="rounded-2xl border border-[var(--border)] bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">On this page</p>
      <ol className="mt-3 space-y-1.5">
        {sections.map((section, index) => (
          <li key={section.id} className="text-[15px]">
            <a href={`#${section.id}`} className="text-[#344054] hover:text-[#1A63F4] hover:underline">
              <span className="sd-num mr-2 text-[var(--muted)]">{index + 1}.</span>
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** What a table of data says, in the same shape on both pages. */
export function DataTable({ rows, columns }: { columns: [string, string, string]; rows: Array<[string, string, string]> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
      <table className="w-full min-w-[520px] border-collapse text-left text-[15.5px]">
        <thead>
          <tr className="bg-[#F9FAFB]">
            {columns.map((column) => (
              <th key={column} className="px-4 py-2.5 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="border-t border-[var(--border)] align-top">
              <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{row[0]}</td>
              <td className="px-4 py-3 text-[var(--muted)]">{row[1]}</td>
              <td className="px-4 py-3 text-[var(--muted)]">{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
