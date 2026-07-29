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
        subject: `StoreDesk setup key for ${message.storeName}`,
        text: [
          `Hello ${message.recipientName},`,
          "",
          `${message.organizationName} authorized StoreDesk Worker setup for ${message.storeName}.`,
          `Setup key: ${message.setupKey}`,
          `Expires: ${message.expiresAt.toISOString()}`,
          "",
          "This key is single-use. It is not a permanent Worker credential.",
          "If you did not expect this message, contact StoreDesk support."
        ].join("\n")
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
