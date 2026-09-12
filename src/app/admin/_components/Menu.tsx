"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import { cx } from "./ui";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
}

/**
 * A row-actions menu. Fixed-positioned so it is never clipped by a scrolling
 * table; arrow keys move, Escape closes and returns focus to the button.
 */
export function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const visible = items.filter((item) => !item.hidden);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const close = () => setOpen(false);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function onKey(e: KeyboardEvent, index: number) {
    if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    let next = -1;
    if (e.key === "ArrowDown") next = (index + 1) % visible.length;
    if (e.key === "ArrowUp") next = (index - 1 + visible.length) % visible.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = visible.length - 1;
    if (next >= 0) {
      e.preventDefault();
      itemRefs.current[next]?.focus();
    }
  }

  if (visible.length === 0) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A63F4]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && pos ? (
        <ul
          ref={menuRef}
          id={id}
          role="menu"
          aria-label={label}
          style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 min-w-52 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {visible.map((item, i) => (
            <li key={item.label} role="none">
              <button
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                onKeyDown={(e) => onKey(e, i)}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cx(
                  "block w-full px-3 py-1.5 text-left text-sm focus:outline-none",
                  item.danger ? "text-red-700 hover:bg-red-50 focus:bg-red-50" : "text-[#111827] hover:bg-slate-100 focus:bg-slate-100"
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
