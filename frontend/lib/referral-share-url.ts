/**
 * Build learner URLs with `?ref=` for referral attribution (signup + first course enrollment).
 */

export function absoluteLearnerUrlWithReferral(path: string, referralCode: string | null | undefined): string {
  if (typeof window === "undefined") return path;
  const u = new URL(path, window.location.origin);
  const code = referralCode?.trim();
  if (code) {
    u.searchParams.set("ref", code.toUpperCase());
  }
  return u.toString();
}
