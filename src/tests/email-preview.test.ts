import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { renderHtml } from "@/lib/email-theme";
import { setupKeyEmail, passwordResetSpec } from "@/lib/email-provider";

/**
 * Not an assertion — a way to look at what we actually send. `EMAIL_PREVIEW=<dir>` writes the
 * rendered messages there so they can be opened in a browser and in a mail client. Email is the one
 * surface where "the tests pass" and "it looks right in Outlook" are different questions.
 */
it("writes the rendered messages when asked", () => {
  const dir = process.env["EMAIL_PREVIEW"];
  if (!dir) return;
  writeFileSync(
    `${dir}/email-setup-key.html`,
    renderHtml(
      setupKeyEmail({
        to: "owner@example.com",
        recipientName: "Sam",
        organizationName: "Patel Retail",
        storeName: "Patel Fuel",
        setupKey: "set_4K7P2M9QX3TR",
        expiresAt: null
      })
    )
  );
  writeFileSync(
    `${dir}/email-password-reset.html`,
    renderHtml(passwordResetSpec({ email: "sam@example.com", name: "Sam", credential: "usr_9QX3.4K7P2M" }))
  );
});
