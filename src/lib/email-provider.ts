import { SITE } from "@/lib/site";

/**
 * Setup keys expire on a clock the recipient can read. Rendered in Eastern time
 * with the zone named, because StoreDesk's stores are US convenience stores and
 * a raw UTC ISO string ("2026-09-11T02:44:00.000Z") reads as noise — or as the
 * wrong day — to someone opening this on a phone in a back office.
 */
function formatExpiry(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short"
  }).format(date);
}

/**
 * The first message a new customer ever receives from StoreDesk.
 *
 * It previously gave them a key and no instructions, described the setup in
 * internal terms ("StoreDesk Worker", "permanent Worker credential"), and told
 * them to contact support without saying how. It now says what the key is for,
 * exactly what to do with it, when it runs out, and who to ask.
 */
export function setupKeyEmailText(message: SetupKeyMessage): string {
  return [
    `Hello ${message.recipientName},`,
    "",
    `${message.organizationName} has set up StoreDesk for ${message.storeName}. Here is the key you need to finish installing it on the store's back-office PC.`,
    "",
    `    ${message.setupKey}`,
    "",
    "To use it:",
    `  1. On the back-office PC, download StoreDesk from https://${SITE.domain}/download`,
    "  2. Run the installer and open StoreDesk.",
    "  3. When it asks for a setup key, paste the key above.",
    "",
    `The key works once and expires ${formatExpiry(message.expiresAt)}.`,
    "If it runs out before you get to it, just reply and we will send a new one.",
    "",
    "Keep this email to yourself — anyone with the key can connect a computer to your store.",
    "",
    `Questions? Reply to this email or write to ${SITE.supportEmail}.`,
    "",
    "— StoreDesk",
    "",
    "If you were not expecting this, you can ignore it; nothing happens until the key is used."
  ].join("\n");
}

export type SetupKeyMessage = {
  to: string;
  recipientName: string;
  organizationName: string;
  storeName: string;
  setupKey: string;
  expiresAt: Date;
};

export type DeliveryResult = {
  provider: string;
  messageId: string;
};

export interface EmailProvider {
  sendSetupKey(message: SetupKeyMessage): Promise<DeliveryResult>;
}

class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string
  ) {}

  async sendSetupKey(message: SetupKeyMessage): Promise<DeliveryResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: `Your StoreDesk setup key for ${message.storeName}`,
        // Replies go to a person, so "reply to this email" in the body is true.
        reply_to: SITE.supportEmail,
        text: setupKeyEmailText(message)
      })
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok || !data.id) {
      throw new Error(data.message || "Email provider rejected setup delivery");
    }
    return { provider: "resend", messageId: data.id };
  }
}

class UnconfiguredEmailProvider implements EmailProvider {
  async sendSetupKey(): Promise<DeliveryResult> {
    throw new Error("Setup email provider is not configured");
  }
}

export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.SETUP_EMAIL_FROM?.trim();
  return apiKey && from ? new ResendEmailProvider(apiKey, from) : new UnconfiguredEmailProvider();
}
