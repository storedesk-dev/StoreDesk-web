import Image from "next/image";

/**
 * The StoreDesk mark with the name as live text. The lockup image draws the
 * name small and in blue-to-green, which is hard to read at admin sizes.
 */
export function BrandLockup({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Image src="/brand/logo-mark.svg" alt="" aria-hidden width={size} height={size} priority />
      <span className="font-extrabold tracking-tight text-[#111827]" style={{ fontSize: Math.round(size * 0.68) }}>
        Store<span className="text-[#00875F]">Desk</span>
      </span>
    </span>
  );
}
