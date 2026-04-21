/**
 * Normalizes tenant/company names for deduplicating the landing "trusted by" list.
 * Keep in sync with backend/src/company/trusted-company-name.ts
 */
export function normalizeTrustedCompanyName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
