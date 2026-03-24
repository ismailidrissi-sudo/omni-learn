/** Persists referral code from `?ref=` so sign-up still attributes after navigating away from the landing URL. */

export const REFERRAL_CODE_STORAGE_KEY = "omni_referral_code";

export function getStoredReferralCode(): string {
  if (typeof window === "undefined") return "";
  try {
    return (localStorage.getItem(REFERRAL_CODE_STORAGE_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function setStoredReferralCode(code: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = code?.trim();
    if (!trimmed) {
      localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
    } else {
      localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, trimmed.toUpperCase());
    }
  } catch {
    /* ignore */
  }
}

export function clearStoredReferralCode(): void {
  setStoredReferralCode(null);
}

export function captureReferralFromSearchParams(searchParams: { get(name: string): string | null }): void {
  const ref = searchParams.get("ref");
  if (ref?.trim()) {
    setStoredReferralCode(ref);
  }
}
