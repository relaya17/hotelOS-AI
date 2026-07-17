const STORAGE_KEY = "hotelos.consentSubject.v1";

/** Stable anonymous/staff subject key for cookie consent rows (not a new UUID each click). */
export function getConsentSubjectKey(prefix: string, userId?: string): string {
  if (userId) {
    return `${prefix}:${userId}`;
  }
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) {
      return existing;
    }
    const next = `${prefix}:${crypto.randomUUID()}`;
    localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return `${prefix}:session`;
  }
}
