"use client";

import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

/** A small "(i) label" button that shows a one-line tip on hover, focus or tap (Escape closes it). */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className="inline-flex items-center gap-1 rounded-full text-[12.5px] font-semibold text-[#1A63F4] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A63F4]/40"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        {label}
      </button>
      {open ? (
        <span
          role="tooltip"
          id={id}
          className="absolute bottom-full right-0 z-20 mb-2 w-72 max-w-[80vw] rounded-xl bg-[#17202A] px-3 py-2 text-left text-[12.5px] leading-snug text-white shadow-lg"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
