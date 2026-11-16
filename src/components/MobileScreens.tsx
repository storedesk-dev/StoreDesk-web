"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Pause, Play } from "lucide-react";
import { PhoneShot } from "@/components/PageHero";

/** Real screens from StoreDesk Mobile on Android, against the demo store. */
const SCREENS = [
  {
    id: "dashboard",
    src: "/screenshots/mobile-app-2.jpeg",
    name: "Today's sales",
    body: "Net sales by department, tax and fuel, with the day's sales listed as the register records them."
  },
  {
    id: "price-book",
    src: "/screenshots/mobile-app-4.jpeg",
    name: "Price book",
    body: "Search by name or barcode, or tap Scan UPC and point the camera at a shelf tag."
  },
  {
    id: "cost",
    src: "/screenshots/mobile-app-6.jpeg",
    name: "Supplier costs",
    body: "Every supplier for the item, cheapest per unit first, marked Best cost."
  },
  {
    id: "item",
    src: "/screenshots/mobile-app-5.jpeg",
    name: "Item",
    body: "The shelf price the register charges, with its barcode, department and tax."
  },
  {
    id: "transaction",
    src: "/screenshots/mobile-app-3.jpeg",
    name: "One sale",
    body: "What was rung up, how it was paid and how the tax was split."
  },
  {
    id: "sign-in",
    src: "/screenshots/mobile-app-1.jpeg",
    name: "Sign in",
    body: "Each person signs in with an account you create. You choose which screens they open."
  }
] as const;

/**
 * StoreDesk Mobile, one screen at a time, as a tab set.
 *
 * One tab stop; arrow keys, Home and End move between screens. It advances on its own only while
 * nobody is looking at it: it stops on hover, on keyboard focus, on any choice, under "reduce
 * motion", and with the Pause button (WCAG 2.2.2).
 */
export function MobileScreens() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const advancing = playing && !hovered && !focused && !reduceMotion;

  useEffect(() => {
    if (!advancing) return;
    const timer = setInterval(() => setActive((index) => (index + 1) % SCREENS.length), 4000);
    return () => clearInterval(timer);
  }, [advancing]);

  function choose(index: number, moveFocus = false) {
    setPlaying(false);
    setActive(index);
    if (moveFocus) tabs.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = SCREENS.length - 1;
    const next =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? active === last ? 0 : active + 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? active === 0 ? last : active - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next < 0) return;
    event.preventDefault();
    choose(next, true);
  }

  const screen = SCREENS[active];

  return (
    <div
      className="grid gap-10 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:items-center lg:gap-16"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div
        id="mobile-screen-panel"
        role="tabpanel"
        aria-labelledby={`mobile-tab-${screen.id}`}
        className="mx-auto w-full max-w-[260px]"
      >
        <PhoneShot src={screen.src} alt={`StoreDesk Mobile, ${screen.name} screen`} sizes="260px" />
      </div>

      <div className="min-w-0">
        <div role="tablist" aria-label="StoreDesk Mobile screens" aria-orientation="vertical" onKeyDown={onKeyDown}>
          {SCREENS.map((item, index) => {
            const on = index === active;
            return (
              <button
                key={item.id}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                id={`mobile-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="mobile-screen-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => choose(index)}
                className={`block w-full border-l-[3px] py-3 pl-5 pr-2 text-left transition-colors ${
                  on ? "border-[var(--blue)] bg-white" : "border-[var(--line)] hover:border-[var(--line-strong)] hover:bg-white/60"
                }`}
              >
                <span className={`block text-[18px] font-bold ${on ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}>{item.name}</span>
                {/* Announced only when a person changes the screen, never on every automatic advance. */}
                {on ? (
                  <span className="mt-1 block text-[16px] leading-snug text-[var(--muted)]" aria-live={advancing ? "off" : "polite"}>
                    {item.body}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {reduceMotion ? null : (
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--line-strong)] bg-white px-4 text-[15px] font-semibold text-[var(--ink)] hover:border-[var(--blue)]"
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
            {playing ? "Pause" : "Play"}
            <span className="sr-only"> the screens</span>
          </button>
        )}
      </div>
    </div>
  );
}
