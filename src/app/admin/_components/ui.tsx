"use client";

/**
 * The admin console's small component kit: a calm, dense internal tool.
 * Brand: StoreDesk blue #1A63F4 / deep #0E43D8, green #00A87B, navy #111827.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from "react";
import { AlertTriangle, Check, Copy, Loader2, X } from "lucide-react";
import { errorMessage } from "../_lib/api";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A63F4]";

// ── Buttons ──────────────────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";

const variants: Record<Variant, string> = {
  primary: "bg-[#1A63F4] text-white hover:bg-[#0E43D8] border border-transparent shadow-sm",
  secondary: "bg-white text-[#111827] border border-slate-300 hover:bg-slate-50 shadow-sm",
  ghost: "bg-transparent text-slate-700 border border-transparent hover:bg-slate-100",
  danger: "bg-red-600 text-white border border-transparent hover:bg-red-700 shadow-sm",
  "danger-ghost": "bg-white text-red-700 border border-red-200 hover:bg-red-50"
};

export function Button({
  variant = "secondary",
  size = "md",
  busy = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
  busy?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type={type}
      disabled={disabled || busy}
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        variants[variant],
        focusRing,
        className
      )}
      {...rest}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

// ── Form controls ────────────────────────────────────────────────────────────

const controlBase =
  "block w-full rounded-md border border-slate-300 bg-white text-sm text-[#111827] placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-red-400 focus:border-[#1A63F4] focus:outline-none focus:ring-2 focus:ring-[#1A63F4]/25";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(controlBase, "h-9 px-3", className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(controlBase, "px-3 py-2", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(controlBase, "h-9 pl-2.5 pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/** Label, control, hint and error, wired together with ids. */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-[13px] font-semibold text-slate-700">
        {label}
        {optional ? <span className="ml-1 font-normal text-slate-400">(optional)</span> : null}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={errorId} className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** An accessible on/off switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
  describedBy
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
  describedBy?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-[#1A63F4]" : "bg-slate-300",
        focusRing
      )}
    >
      <span
        aria-hidden
        className={cx(
          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-xs font-medium text-slate-500">{eyebrow}</div> : null}
        <h1 className="truncate text-[22px] font-extrabold tracking-tight text-[#111827]">{title}</h1>
        {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(17,24,39,0.04)]", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-bold tracking-tight text-[#111827]">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[13px] text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cx("px-4 py-3", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Label / value rows inside a card. */
export function DefinitionList({ rows }: { rows: Array<{ label: ReactNode; value: ReactNode; action?: ReactNode }> }) {
  return (
    <dl className="divide-y divide-slate-100">
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
          <dt className="w-44 shrink-0 text-[13px] font-medium text-slate-500">{row.label}</dt>
          <dd className="min-w-0 flex-1 text-sm text-[#111827]">{row.value}</dd>
          {row.action ? <div className="flex items-center gap-2">{row.action}</div> : null}
        </div>
      ))}
    </dl>
  );
}

// ── Tables ───────────────────────────────────────────────────────────────────

export const table = {
  wrap: "overflow-x-auto rounded-lg border border-slate-200 bg-white",
  table: "w-full border-collapse text-left text-sm sd-num",
  thead: "border-b border-slate-200 bg-slate-50/80",
  th: "px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap",
  tr: "border-b border-slate-100 last:border-0 hover:bg-slate-50/60",
  td: "px-3 py-2.5 align-middle"
};

// ── Status ───────────────────────────────────────────────────────────────────

export type Tone = "green" | "blue" | "amber" | "red" | "gray" | "navy";

const tones: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  blue: "bg-blue-50 text-[#0E43D8] ring-[#1A63F4]/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  gray: "bg-slate-100 text-slate-600 ring-slate-500/20",
  navy: "bg-[#111827] text-white ring-transparent"
};

const dotTones: Record<Tone, string> = {
  green: "bg-[#00A87B]",
  blue: "bg-[#1A63F4]",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gray: "bg-slate-400",
  navy: "bg-white"
};

export function Chip({ tone = "gray", dot, children, title }: { tone?: Tone; dot?: boolean; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset",
        tones[tone]
      )}
    >
      {dot ? <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", dotTones[tone])} /> : null}
      {children}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}…
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-semibold text-[#111827]">{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-md text-sm text-slate-500">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorBanner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">{errorMessage(error)}</p>
      {onRetry ? (
        <Button size="sm" variant="danger-ghost" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Notice({ tone = "blue", children }: { tone?: "blue" | "amber" | "green" | "red"; children: ReactNode }) {
  const map = {
    blue: "border-blue-200 bg-blue-50 text-[#0E43D8]",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    red: "border-red-200 bg-red-50 text-red-800"
  } as const;
  return <div className={cx("rounded-md border px-3 py-2 text-[13px]", map[tone])}>{children}</div>;
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

export function Tabs<K extends string>({
  tabs,
  active,
  onChange,
  label
}: {
  tabs: Array<{ key: K; label: ReactNode; count?: number | null }>;
  active: K;
  onChange: (key: K) => void;
  label: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      refs.current[next]?.focus();
      onChange(tabs[next].key);
    }
  }
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab, i) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`tab-${tab.key}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.key}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              selected
                ? "border-[#1A63F4] text-[#0E43D8]"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-[#111827]",
              focusRing
            )}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span className={cx("rounded-full px-1.5 text-[11px] sd-num", selected ? "bg-blue-50" : "bg-slate-100")}>
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="pt-5">
      {children}
    </div>
  );
}

// ── Dialogs ──────────────────────────────────────────────────────────────────

/**
 * Modal dialog on the native <dialog> element: focus moves in, Escape closes,
 * the page behind is inert, and focus returns to the opener on close.
 * Children render only while open, so forms start fresh each time.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissable = true
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** False while something must be read first (a one-time secret) or a request is running. */
  dismissable?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissable) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && dismissable) onClose();
      }}
      className={cx(
        "m-auto w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white p-0 text-[#111827] shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]",
        widths[size]
      )}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 id={titleId} className="text-base font-bold tracking-tight">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-0.5 text-[13px] text-slate-500">
                  {description}
                </p>
              ) : null}
            </div>
            {dismissable ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={cx("rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700", focusRing)}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </header>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              {footer}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * Confirmation for anything that changes a customer's setup. Destructive ones
 * are red; the most destructive make the operator type a value (the org tag).
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  destructive = false,
  typeToConfirm,
  onConfirm
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  typeToConfirm?: string;
  /** Throw to keep the dialog open; the message is shown inside it. */
  onConfirm: () => Promise<void> | void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setTyped("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const blocked = typeToConfirm !== undefined && typed.trim() !== typeToConfirm;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      dismissable={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={confirm} busy={busy} disabled={blocked}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocked && !busy) void confirm();
        }}
        className="space-y-3 text-sm text-slate-700"
      >
        {children}
        {typeToConfirm !== undefined ? (
          <Field label={<>Type <code className="rounded bg-slate-100 px-1 font-mono text-[12px]">{typeToConfirm}</code> to confirm</>}>
            {(p) => (
              <Input {...p} autoFocus autoComplete="off" spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />
            )}
          </Field>
        ) : null}
        {error ? <p className="text-sm font-medium text-red-600" role="alert">{errorMessage(error)}</p> : null}
      </form>
    </Dialog>
  );
}

// ── Copy and one-time secrets ────────────────────────────────────────────────

export function CopyButton({ value, label = "Copy", size = "sm" }: { value: string; label?: string; size?: "sm" | "md" }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; the value is still visible to select */
    }
  }, [value]);
  return (
    <Button size={size} variant="secondary" onClick={copy} icon={copied ? <Check className="h-3.5 w-3.5 text-[#00A87B]" /> : <Copy className="h-3.5 w-3.5" />}>
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}

/** A value shown exactly once (setup key, invitation code, generated password). */
export function SecretBox({ label, value, note }: { label: string; value: string; note?: ReactNode }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold uppercase tracking-wider text-amber-900">{label}</span>
        <CopyButton value={value} />
      </div>
      <code className="block select-all break-all rounded bg-white px-2.5 py-2 font-mono text-[13px] leading-relaxed text-[#111827] ring-1 ring-amber-200">
        {value}
      </code>
      <p className="mt-1.5 text-xs text-amber-900">{note ?? "Shown once. Copy it now — it can't be shown again."}</p>
    </div>
  );
}

// ── Data loading ─────────────────────────────────────────────────────────────

/** Load on mount and whenever `deps` change; `reload()` re-runs; `setData` for optimistic updates. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loadRef.current();
      if (mine === seq.current) setData(result);
      return result;
    } catch (e) {
      if (mine === seq.current) setError(e);
      return null;
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, error, loading, reload };
}
