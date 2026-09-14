const STORAGE_KEY = "inorme-cookie-consent";

export type CookieConsentStatus = "accepted" | "rejected";

export function getCookieConsent(): CookieConsentStatus | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "accepted" || value === "rejected") return value;
  } catch {
    // ignore
  }
  return null;
}

export function setCookieConsent(status: CookieConsentStatus): void {
  try {
    localStorage.setItem(STORAGE_KEY, status);
  } catch {
    // ignore
  }
}
