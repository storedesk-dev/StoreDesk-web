/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source:    shared/pages-registry.ts (electron + mobile)
 * Regenerate: node scripts/generate-pages-registry.mjs
 * Verify:     node scripts/generate-pages-registry.mjs --check
 */

export type App = "electron" | "mobile";

export interface PageFeatureFlagDef {
  label: string;
  description: string;
  default: boolean;
}

export interface PageDefinition {
  key: string;
  label: string;
  description: string;
  app: App;
  filePath: string;
  defaultEnabled: boolean;
  alwaysEnabled?: boolean;
  knownFeatureFlags: Record<string, PageFeatureFlagDef>;
}

export const ALL_PAGES: PageDefinition[] = [

];

export const PAGE_KEYS: string[] = ALL_PAGES.map((page) => page.key);

export function getPage(key: string): PageDefinition | undefined {
  return ALL_PAGES.find((page) => page.key === key);
}
