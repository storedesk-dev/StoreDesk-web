/** The wordmark as live text: "Store" in ink, "Desk" in the brand green, as the desktop app sets it. */
export function Wordmark({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="text-[19px] font-extrabold tracking-[-0.02em]">
      <span className={onDark ? "text-white" : "text-[var(--ink)]"}>Store</span>
      <span className={onDark ? "text-[#3fd1a2]" : "text-[#00875F]"}>Desk</span>
    </span>
  );
}
