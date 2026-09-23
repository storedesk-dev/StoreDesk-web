import { SITE } from "@/lib/site";

/**
 * One look for every message StoreDesk sends.
 *
 * Email is not the web and this file exists because of it. Mail clients are twenty years of
 * different HTML engines: Outlook renders through Word, Gmail strips `<style>` blocks it dislikes,
 * and plenty of them block remote images until a person clicks. So:
 *
 * - **tables for layout**, never flex or grid;
 * - **inline styles**, because a stripped stylesheet leaves unreadable text rather than plain text;
 * - **no web fonts and no images**, so nothing depends on a download that may never happen — the
 *   wordmark is text;
 * - **a plain-text part for every message**, which is what a screen reader, a watch and a spam
 *   filter all prefer, and what survives when everything else fails.
 *
 * Every message is built from the same small spec, so a new one cannot quietly look different.
 */

const BRAND = {
  teal: "#008662",
  ink: "#0F172A",
  body: "#334155",
  muted: "#64748B",
  ground: "#F4F7FB",
  paper: "#FFFFFF",
  rule: "#E2E8F0",
  calloutBg: "#F1F5F9"
} as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

/** The address every StoreDesk message comes from, unless the deployment overrides it. */
export const DEFAULT_FROM = `StoreDesk <No-Reply@${SITE.domain}>`;

export interface EmailSpec {
  /** The line a phone shows under the subject. Written, not left to chance. */
  readonly preheader: string;
  readonly heading: string;
  /** Paragraphs, in order. Plain sentences — no markup. */
  readonly body: readonly string[];
  /** A code to read and type: the setup key, the reset code. Shown big and monospaced. */
  readonly callout?: { readonly label: string; readonly value: string };
  /** The one thing to do. A button in HTML, the bare URL in text. */
  readonly action?: { readonly label: string; readonly url: string };
  /** After the action: what to do if it was not them, when something expires, who to ask. */
  readonly footnote?: readonly string[];
}

const escape = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * The action button.
 *
 * A `<table>` with a background colour rather than a styled `<a>`: Outlook ignores padding on an
 * anchor, which turns a button into a bare link in the one client a back-office PC is most likely
 * to be running.
 */
function button(label: string, url: string): string {
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
        <tr>
          <td align="center" bgcolor="${BRAND.teal}" style="border-radius:6px;">
            <a href="${escape(url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:6px;">${escape(label)}</a>
          </td>
        </tr>
      </table>`;
}

function callout(label: string, value: string): string {
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0;">
        <tr>
          <td style="background:${BRAND.calloutBg};border:1px solid ${BRAND.rule};border-radius:6px;padding:16px 18px;">
            <div style="font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.muted};padding-bottom:6px;">${escape(label)}</div>
            <div style="font-family:${MONO};font-size:22px;font-weight:600;color:${BRAND.ink};word-break:break-all;">${escape(value)}</div>
          </td>
        </tr>
      </table>`;
}

/** The HTML part. 600px, centred, on the brand ground. */
export function renderHtml(spec: EmailSpec): string {
  const paragraphs = spec.body
    .map(
      (line) =>
        `      <p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BRAND.body};">${escape(line)}</p>`
    )
    .join("\n");

  const notes = (spec.footnote ?? [])
    .map(
      (line) =>
        `      <p style="margin:0 0 10px;font-family:${FONT};font-size:13px;line-height:1.6;color:${BRAND.muted};">${escape(line)}</p>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escape(spec.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.ground};">
  <!-- The line a phone shows beside the subject. Hidden in the message itself. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(spec.preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.ground};">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">
          <tr>
            <td style="padding:0 0 18px;font-family:${FONT};font-size:17px;font-weight:700;color:${BRAND.teal};letter-spacing:-0.01em;">
              ${escape(SITE.name)}
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.paper};border:1px solid ${BRAND.rule};border-radius:10px;padding:32px 30px;">
              <h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:600;color:${BRAND.ink};">${escape(spec.heading)}</h1>
${paragraphs}${spec.callout ? callout(spec.callout.label, spec.callout.value) : ""}${spec.action ? button(spec.action.label, spec.action.url) : ""}
${notes ? `              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:6px;border-top:1px solid ${BRAND.rule};">
                <tr><td style="padding-top:16px;">
${notes}
                </td></tr>
              </table>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.muted};">
              ${escape(SITE.tagline)}<br>
              Questions? Reply to this message or write to
              <a href="mailto:${escape(SITE.supportEmail)}" style="color:${BRAND.teal};">${escape(SITE.supportEmail)}</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * The plain-text part, from the same spec.
 *
 * Not a fallback nobody reads: a link in text is a link somebody can check before they click,
 * which matters most in exactly the messages that carry a credential.
 */
export function renderText(spec: EmailSpec): string {
  const lines: string[] = [spec.heading, "", ...spec.body];
  if (spec.callout) lines.push("", `${spec.callout.label}: ${spec.callout.value}`);
  if (spec.action) lines.push("", `${spec.action.label}: ${spec.action.url}`);
  if (spec.footnote?.length) lines.push("", ...spec.footnote);
  lines.push("", `— ${SITE.name}`, `Questions? Reply to this message or write to ${SITE.supportEmail}.`, "");
  return lines.join("\n");
}

/** Both parts of one message. */
export function renderEmail(spec: EmailSpec): { html: string; text: string } {
  return { html: renderHtml(spec), text: renderText(spec) };
}
