import { describe, expect, it } from "vitest";
import { DEFAULT_FROM, renderEmail, renderHtml, renderText } from "@/lib/email-theme";

const spec = {
  preheader: "Your setup key for Patel Fuel",
  heading: "Set up StoreDesk on your store PC",
  body: ["This key sets one PC up for Patel Fuel.", "Open StoreDesk on that PC and paste it in."],
  callout: { label: "Setup key", value: "set_4K7P2M9QX3TR" },
  action: { label: "Read the setup guide", url: "https://docs.storedesk.net/desktop/get-started/install" },
  footnote: ["The key expires on Friday, September 26 at 5:00 PM EDT.", "If you did not expect this, tell us."]
};

describe("every message looks like StoreDesk", () => {
  it("comes from No-Reply, not from a person", () => {
    expect(DEFAULT_FROM).toBe("StoreDesk <No-Reply@storedesk.net>");
  });

  it("renders both parts from one spec, so they cannot drift apart", () => {
    const { html, text } = renderEmail(spec);
    for (const line of spec.body) {
      expect(html).toContain(line);
      expect(text).toContain(line);
    }
    expect(html).toContain(spec.callout.value);
    expect(text).toContain(spec.callout.value);
    expect(html).toContain(spec.action.url);
    expect(text).toContain(spec.action.url);
  });

  it("puts the preheader where a phone reads it and a person does not", () => {
    const html = renderHtml(spec);
    expect(html).toContain(spec.preheader);
    // Hidden in the message body itself: it is the line beside the subject, not a first paragraph.
    expect(html).toMatch(/display:none;max-height:0;overflow:hidden;opacity:0;">Your setup key/);
  });
});

describe("the things mail clients break", () => {
  const html = renderHtml(spec);

  it("lays out with tables, because Outlook renders through Word", () => {
    expect(html).toContain('role="presentation"');
    expect(html).not.toMatch(/display:\s*(flex|grid)/);
  });

  it("styles inline, so a stripped stylesheet leaves readable text", () => {
    // No <style> block at all: Gmail and others drop them, and then the message is unstyled soup.
    expect(html).not.toContain("<style");
    expect(html).toContain("font-family:");
  });

  it("makes the button a table cell, not a padded anchor", () => {
    // Outlook ignores padding on an <a>, which turns a button into a bare link on exactly the PC
    // a back office is most likely to be running.
    expect(html).toMatch(/bgcolor="#008662"/);
    expect(html).not.toContain("<button");
  });

  it("carries the logo, and reads as StoreDesk when the image is blocked", () => {
    // Absolute, because a mail client has no page to be relative to. PNG, because Outlook and
    // several others do not render SVG. And the alt is the wordmark, so a blocked image is still
    // the brand rather than a broken box.
    expect(html).toContain("https://storedesk.net/brand/logo-lockup-horizontal.png");
    expect(html).toMatch(/alt="StoreDesk"/);
    expect(html).toMatch(/width="144" height="40"/);
    expect(html).not.toContain(".svg");
  });

  it("still asks for no web font", () => {
    expect(html).not.toContain("fonts.googleapis");
    expect(html).not.toContain("@font-face");
  });

  it("has no script, because every mail client strips it", () => {
    // This is why there is no copy button in an email. It is not caution, it is the platform.
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/on(click|load|mouseover)=/);
  });

  it("declares a light colour scheme rather than letting a dark client invert it", () => {
    expect(html).toContain('name="color-scheme" content="light"');
  });
});

describe("what goes in a message is not trusted", () => {
  it("escapes a value that would otherwise close a tag", () => {
    const html = renderHtml({
      preheader: "p",
      heading: 'Store "A" & <b>B</b>',
      body: ['a <script>alert(1)</script> line'],
      callout: { label: "Key", value: '"><img src=x>' }
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    // The logo is the only <img> in the message; the injected one must not have become a tag.
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&quot;&gt;&lt;img src=x&gt;");
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain("Store &quot;A&quot; &amp; &lt;b&gt;B&lt;/b&gt;");
  });

  it("escapes a URL into the href without breaking out of the attribute", () => {
    const html = renderHtml({
      preheader: "p",
      heading: "h",
      body: [],
      action: { label: "Go", url: 'https://x/?a="onmouseover="alert(1)' }
    });
    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).toContain("&quot;onmouseover=&quot;");
  });
});

describe("the text part", () => {
  it("stands on its own, with the link written out to be read before it is clicked", () => {
    const text = renderText(spec);
    expect(text.startsWith(spec.heading)).toBe(true);
    expect(text).toContain("Setup key: set_4K7P2M9QX3TR");
    expect(text).toContain("Read the setup guide: https://docs.storedesk.net/");
    expect(text).toContain("— StoreDesk");
    expect(text).not.toContain("<");
  });

  it("leaves out the parts a message does not have", () => {
    const text = renderText({ preheader: "p", heading: "Just a note", body: ["One line."] });
    expect(text).toContain("One line.");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain(": null");
  });
});
