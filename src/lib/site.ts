export const SITE = {
  name: "StoreDesk",
  email: "storedesk.dev@gmail.com",
  github: "https://github.com/storedesk-dev",
  tagline: "Worker, Desktop, and Mobile on your backoffice PC"
} as const;

/** Opens the user’s mail client with To pre-filled to the StoreDesk inbox. */
export function contactMailto(options?: { subject?: string; body?: string }) {
  const params = new URLSearchParams();
  params.set("subject", options?.subject ?? "StoreDesk inquiry");
  if (options?.body) params.set("body", options.body);
  return `mailto:${SITE.email}?${params.toString()}`;
}

export const NAV = [
  { href: "/product", label: "Product" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
] as const;
