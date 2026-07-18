import { postErrorEvent } from "./api-client.js";
import { readAccessToken, readStoredUser } from "./session.js";

const recentKeys = new Set<string>();
const MAX_RECENT = 20;

function shouldReport(key: string): boolean {
  if (recentKeys.has(key)) return false;
  recentKeys.add(key);
  if (recentKeys.size > MAX_RECENT) {
    const first = recentKeys.values().next().value;
    if (first !== undefined) recentKeys.delete(first);
  }
  return true;
}

/**
 * When the user is signed in, forward uncaught errors to IT via
 * `POST /v1/ops/error-events` (HotelOS inbox). No-op without a session.
 */
export function installClientErrorReporting(appName: string): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    const message = event.message || "Unknown error";
    const key = `error:${message}`;
    if (!shouldReport(key)) return;
    void report(appName, message, event.error);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    const key = `rejection:${message}`;
    if (!shouldReport(key)) return;
    void report(appName, message, reason);
  });
}

async function report(
  appName: string,
  title: string,
  detail: unknown,
): Promise<void> {
  if (!readAccessToken()) return;
  const user = readStoredUser();
  const stack =
    detail instanceof Error
      ? detail.stack ?? detail.message
      : typeof detail === "string"
        ? detail
        : JSON.stringify(detail);
  try {
    await postErrorEvent({
      title: title.slice(0, 200),
      description: String(stack).slice(0, 4000),
      source: "browser",
      app: appName,
      priority: "medium",
      ...(user?.hotelId !== undefined ? { hotelId: user.hotelId } : {}),
    });
  } catch {
    // Never block UX on reporting failures.
  }
}
