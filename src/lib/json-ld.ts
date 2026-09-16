/**
 * Structured data, embedded safely.
 *
 * `JSON.stringify` escapes quotes and backslashes but not `<`, so any string that reaches a
 * `<script type="application/ld+json">` block can close it and open a new one. That was only
 * theoretical while every value was a constant in this repo. It stopped being theoretical when the
 * software entry started carrying fields read from the release manifest over the network: a
 * compromised or simply mistaken `release.json` would then run script on every page of the site,
 * and the admin console shares the root layout.
 *
 * So: one helper, used for every `ld+json` block. It escapes the characters that can end the
 * element, and U+2028 / U+2029, which are ordinary characters in JSON but line terminators in
 * JavaScript. Validating the manifest as well (`lib/release.ts`) is the other half of this; escaping
 * here is the half that holds whatever the input turns out to be.
 *
 * The table is keyed by code point rather than by the characters themselves: U+2028 written into a
 * source file is a line break to every JavaScript parser, which makes the file it appears in fail
 * to compile.
 */
const ESCAPED = new Map<number, string>([
  [0x3c, "\\u003c"],
  [0x3e, "\\u003e"],
  [0x26, "\\u0026"],
  [0x2028, "\\u2028"],
  [0x2029, "\\u2029"]
]);

export function jsonLdScript(data: unknown): string {
  let out = "";
  for (const character of JSON.stringify(data)) {
    out += ESCAPED.get(character.codePointAt(0) ?? 0) ?? character;
  }
  return out;
}
