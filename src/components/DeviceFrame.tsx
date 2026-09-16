import type { ReactNode } from "react";

/**
 * Plain device chrome for the product page, so a screen is obviously a screen.
 *
 * The feature panels used to be bare tables floating on a tinted card, which left it unclear whether
 * you were looking at the desktop app, the phone, or a diagram. A laptop lid and a phone body cost a
 * few divs and answer that before anyone reads a word. Both are pure CSS: no images to ship, and they
 * scale with the panel they sit in.
 */

/** The desktop app, in a laptop. `chrome` is the title shown in the window bar. */
export function LaptopFrame({ chrome, children }: { chrome: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[460px]">
      <div className="rounded-t-xl border border-b-0 border-[#C8CFDA] bg-[#E8ECF3] p-1.5 shadow-[0_18px_40px_-24px_rgba(23,32,42,0.45)]">
        <div className="flex items-center gap-1.5 px-1.5 py-1">
          <span className="h-2 w-2 rounded-full bg-[#F87171]" />
          <span className="h-2 w-2 rounded-full bg-[#FBBF24]" />
          <span className="h-2 w-2 rounded-full bg-[#34D399]" />
          <span className="ml-2 truncate text-[10.5px] font-semibold text-[#64748B]">{chrome}</span>
        </div>
        <div className="overflow-hidden rounded-md border border-[#D7DEE8] bg-white">{children}</div>
      </div>
      {/* The base, which is what makes it read as a laptop rather than a floating window. */}
      <div className="mx-auto h-2 w-[112%] max-w-none -translate-x-[5.5%] rounded-b-xl bg-gradient-to-b from-[#C8CFDA] to-[#AEB8C7]" />
      <div className="mx-auto h-1 w-[46%] rounded-b-full bg-[#9AA6B8]" />
    </div>
  );
}

/** The phone app, at a size where a shelf-tag result is actually readable. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[236px]">
      <div className="rounded-[30px] border-[6px] border-[#17202A] bg-[#17202A] shadow-[0_24px_50px_-24px_rgba(23,32,42,0.6)]">
        <div className="relative overflow-hidden rounded-[24px] bg-white">
          {/* The notch, so the frame reads as a phone at a glance. */}
          <div className="absolute left-1/2 top-0 z-10 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-[#17202A]" />
          <div className="flex items-center justify-between px-4 pb-1 pt-1.5 text-[9px] font-semibold text-[#64748B]">
            <span className="sd-num">9:41</span>
            <span>StoreDesk</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
