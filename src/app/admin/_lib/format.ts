/** Small formatting helpers for the admin console. Dates are shown in the operator's local time. */

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 2026-09-12 */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 2026-09-12 10:14 */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 09-12 10:14 — for dense activity lists in the current year. */
export function formatShortDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  if (d.getFullYear() !== new Date().getFullYear()) return formatDateTime(d);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Whole days from now until `value`; negative once it has passed. */
export function daysUntil(value: string | Date | null | undefined): number | null {
  const d = toDate(value);
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

export function daysLeftLabel(value: string | Date | null | undefined): string {
  const days = daysUntil(value);
  if (days === null) return "";
  if (days < 0) return `ended ${plural(-days, "day")} ago`;
  if (days === 0) return "ends today";
  return `${plural(days, "day")} left`;
}

/** "2 min ago", "3 h ago", "5 d ago" */
export function relativeTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "never";
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days} d ago`;
  return formatDate(d);
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

export const ORG_TAG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Why an org tag is not acceptable, or null when it is. */
export function orgTagProblem(tag: string): string | null {
  if (!tag) return "Required.";
  if (tag.length > 40) return "40 characters at most.";
  if (/[A-Z]/.test(tag)) return "Lower-case letters only.";
  if (/[^a-z0-9-]/.test(tag)) return "Only letters, numbers and hyphens.";
  if (tag.startsWith("-") || tag.endsWith("-")) return "Can't start or end with a hyphen.";
  if (!ORG_TAG_PATTERN.test(tag)) return "Not a valid org tag.";
  return null;
}

/** A suggested org tag from an organization name. */
export function suggestOrgTag(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** A readable random password for managed logins: 4 groups, no look-alike characters. */
export function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

export const US_TIME_ZONES: Array<{ value: string; label: string }> = [
  { value: "America/New_York", label: "Eastern — New York" },
  { value: "America/Detroit", label: "Eastern — Detroit" },
  { value: "America/Indiana/Indianapolis", label: "Eastern — Indianapolis" },
  { value: "America/Chicago", label: "Central — Chicago" },
  { value: "America/Denver", label: "Mountain — Denver" },
  { value: "America/Phoenix", label: "Mountain, no DST — Phoenix" },
  { value: "America/Los_Angeles", label: "Pacific — Los Angeles" },
  { value: "America/Anchorage", label: "Alaska — Anchorage" },
  { value: "Pacific/Honolulu", label: "Hawaii — Honolulu" },
  { value: "America/Puerto_Rico", label: "Atlantic — Puerto Rico" }
];

export function timeZoneLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return US_TIME_ZONES.find((tz) => tz.value === value)?.label ?? value;
}
