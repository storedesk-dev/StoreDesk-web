import { SITE } from "@/lib/site";
import { DEFAULT_FROM, renderEmail, renderText, type EmailSpec } from "@/lib/email-theme";

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
/**
 * The spec every part of this message is built from — the themed HTML and the plain text both.
 *
 * The key is a **callout, never a link**. A credential in a URL ends up in browser history and in
 * proxy logs, so the button goes to the download page and the person types the key themselves.
 */
export function setupKeyEmail(message: SetupKeyMessage): EmailSpec {
  return {
    preheader: `Your setup key for ${message.storeName}`,
    heading: `Finish setting up StoreDesk for ${message.storeName}`,
    body: [
      `Hello ${message.recipientName},`,
      `${message.organizationName} has set up StoreDesk for ${message.storeName}. Here is the key you need to finish installing it on the store's back-office PC.`,
      "Download StoreDesk on that PC, run the installer, open it, and paste the key above when it asks."
    ],
    callout: { label: "Setup key", value: message.setupKey },
    action: { label: "Download StoreDesk", url: `https://${SITE.domain}/download` },
    footnote: [
      ...(message.expiresAt
        ? [
            `The key works once and expires ${formatExpiry(message.expiresAt)}.`,
            "If it runs out before you get to it, just reply and we will send a new one."
          ]
        : [
            // 0.0.9: a redeem consumes the key and mints the next one in the same transaction
            // (lib/store-setup-key.ts), so "keep the key and use it again" is no longer true.
            "The key works until it is used. StoreDesk then makes a new one, so there is nothing to keep.",
            "To set up another PC later, an organization admin reads the current key on the store PC, in StoreDesk Service → Replace PC. The new PC takes over and the old one stops working for the store."
          ]),
      "Keep this email to yourself — anyone with the key can connect a computer to your store.",
      "If you were not expecting this, you can ignore it; nothing happens until the key is used."
    ]
  };
}

/** @deprecated kept so existing callers and the copy tests keep working; it is the text part. */
export function setupKeyEmailText(message: SetupKeyMessage): string {
  return renderText(setupKeyEmail(message));
}


export type SetupKeyMessage = {
  to: string;
  recipientName: string;
  organizationName: string;
  storeName: string;
  setupKey: string;
  /** Null for a reusable key, which never expires. */
  expiresAt: Date | null;
};

export type InstallationReplacedMessage = {
  to: string;
  organizationName: string;
  storeName: string;
  /** "activation": a setup key was redeemed on another PC. "admin": StoreDesk replaced it from the console. */
  by: "activation" | "admin";
  at: Date;
};

export type InvitationMessage = {
  to: string;
  recipientName: string;
  organizationName: string;
  invitationCode: string;
  expiresAt: Date;
};

/**
 * A user invited by e-mail. The code is pasted at /enroll (never put in a
 * link: a credential in a URL ends up in browser history and proxy logs).
 */
/**
 * The first message a person ever gets from StoreDesk.
 *
 * Somebody at their business created the account; they did not ask for it and may never have heard
 * of us. So it says who added them and what it is for before it asks them to do anything — an
 * unexplained code from an unknown sender is a phishing e-mail, and reads like one.
 */
export function invitationEmail(message: InvitationMessage): EmailSpec {
  return {
    preheader: `${message.organizationName} has set up your StoreDesk account`,
    heading: "Welcome to StoreDesk",
    body: [
      `Hello ${message.recipientName},`,
      `${message.organizationName} has set up a StoreDesk account for you. StoreDesk is the back-office software their store runs — prices, daily numbers and reports.`,
      "To finish, open the page below and paste this code to choose your password:",
      "Then sign in on the store PC or your phone with this e-mail address and the password you chose."
    ],
    callout: { label: "Your code", value: message.invitationCode },
    action: { label: "Set your password", url: `https://${SITE.domain}/enroll` },
    footnote: [
      `The code works once and expires ${formatExpiry(message.expiresAt)}.`,
      "Keep this e-mail to yourself — anyone with the code can set your password.",
      "If you were not expecting this, you can ignore it; nothing happens until the code is used."
    ]
  };
}

export function invitationEmailText(message: InvitationMessage): string {
  return renderText(invitationEmail(message));
}


export interface PasswordResetMessage {
  email: string;
  name: string | null;
  credential: string;
}

/**
 * Resetting a password. Short, and it says plainly what happens if it was not
 * them — because the one person who must not be confused by this message is
 * someone who did not ask for it.
 */
export function passwordResetSpec(message: PasswordResetMessage): EmailSpec {
  return {
    preheader: "Your StoreDesk password reset code",
    heading: "Reset your StoreDesk password",
    body: [
      `Hello ${message.name ?? "there"},`,
      `Someone asked to reset the StoreDesk password for ${message.email}. To choose a new one, open the page below and paste this code:`
    ],
    callout: { label: "Your code", value: message.credential },
    action: { label: "Choose a new password", url: `https://${SITE.domain}/reset-password` },
    footnote: [
      "The code works once and runs out in an hour.",
      "If you did not ask for this, you can ignore it: your password has not changed, and nothing happens until the code is used."
    ]
  };
}

export function passwordResetEmail(message: PasswordResetMessage): string {
  return renderText(passwordResetSpec(message));
}


/**
 * The organization owner is told every time a store's PC is replaced, because
 * a replacement moves the whole store to another computer. Plain, short, and
 * carrying no key: it says what happened, where, when, and what to do if it
 * was not them.
 */
export function installationReplacedEmail(message: InstallationReplacedMessage): EmailSpec {
  return {
    preheader: `The StoreDesk PC for ${message.storeName} was replaced`,
    heading: `The StoreDesk PC for ${message.storeName} was replaced`,
    body: [
      `Organization: ${message.organizationName}`,
      `Store: ${message.storeName}`,
      `When: ${formatExpiry(message.at)}`,
      message.by === "admin"
        ? "Replaced by StoreDesk support, at your organization's request."
        : "A setup key was used to set StoreDesk up on a computer, and that computer took the store over.",
      "The old PC no longer works for this store: it can no longer sign anyone in or reach the register."
    ],
    footnote: [
      `If this was not you or someone you asked, write to ${SITE.supportEmail} straight away and we will rotate the store's setup key.`
    ]
  };
}

export function installationReplacedEmailText(message: InstallationReplacedMessage): string {
  return renderText(installationReplacedEmail(message));
}


export type DeliveryResult = {
  provider: string;
  messageId: string;
};

export interface EmailProvider {
  sendSetupKey(message: SetupKeyMessage): Promise<DeliveryResult>;
  sendInvitation(message: InvitationMessage): Promise<DeliveryResult>;
  sendInstallationReplaced(message: InstallationReplacedMessage): Promise<DeliveryResult>;
  sendPasswordReset(message: PasswordResetMessage): Promise<DeliveryResult>;
}

class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string
  ) {}

  /**
   * Send one message, both parts.
   *
   * `html` and `text` are rendered from the same spec, so they cannot say different things —
   * which matters because plenty of recipients only ever see the second one, and a spam filter
   * reads both. The From is No-Reply; `reply_to` is a person, so "reply to this message" is true.
   */
  private async send(to: string, subject: string, spec: EmailSpec, failure: string): Promise<DeliveryResult> {
    const { html, text } = renderEmail(spec);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: this.from,
        to: [to],
        subject,
        reply_to: SITE.supportEmail,
        html,
        text
      })
    });
    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok || !data.id) {
      throw new Error(data.message || failure);
    }
    return { provider: "resend", messageId: data.id };
  }

  sendSetupKey(message: SetupKeyMessage): Promise<DeliveryResult> {
    return this.send(
      message.to,
      `Your StoreDesk setup key for ${message.storeName}`,
      setupKeyEmail(message),
      "Email provider rejected setup delivery"
    );
  }

  sendInvitation(message: InvitationMessage): Promise<DeliveryResult> {
    return this.send(
      message.to,
      `Your StoreDesk login for ${message.organizationName}`,
      invitationEmail(message),
      "Email provider rejected the invitation"
    );
  }

  sendInstallationReplaced(message: InstallationReplacedMessage): Promise<DeliveryResult> {
    return this.send(
      message.to,
      `The StoreDesk PC for ${message.storeName} was replaced`,
      installationReplacedEmail(message),
      "Email provider rejected the replacement notice"
    );
  }

  /** The code in this one is the account: it goes to the person's mailbox and nowhere else. */
  sendPasswordReset(message: PasswordResetMessage): Promise<DeliveryResult> {
    return this.send(
      message.email,
      "Reset your StoreDesk password",
      passwordResetSpec(message),
      "Email provider rejected the password reset"
    );
  }
}

class UnconfiguredEmailProvider implements EmailProvider {
  async sendSetupKey(): Promise<DeliveryResult> {
    throw new Error("Setup email provider is not configured");
  }

  async sendInvitation(): Promise<DeliveryResult> {
    throw new Error("Email provider is not configured");
  }

  async sendInstallationReplaced(): Promise<DeliveryResult> {
    throw new Error("Email provider is not configured");
  }

  async sendPasswordReset(): Promise<DeliveryResult> {
    throw new Error("Email provider is not configured");
  }
}

/** RESEND_API_KEY and SETUP_EMAIL_FROM are both set. */
/**
 * Only the key is required. The From has a sensible default (No-Reply at our own domain), because
 * a deployment that set the key and forgot the address should still send — silently not sending is
 * the worst of the three outcomes.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  // No-Reply at our own domain unless the deployment names another sender.
  const from = process.env.SETUP_EMAIL_FROM?.trim() || DEFAULT_FROM;
  return apiKey ? new ResendEmailProvider(apiKey, from) : new UnconfiguredEmailProvider();
}
