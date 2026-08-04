import { useEffect, useState } from "react";
import { fetchPublicHealth, type PublicHealthDto } from "@hotelos/web-client";

type HealthState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "ok";
      readonly data: PublicHealthDto;
      readonly checkedAt: string;
    }
  | { readonly kind: "error"; readonly message: string; readonly checkedAt: string };

const EXTERNAL_STATUS_PAGE_URL = (
  import.meta.env["VITE_STATUS_PAGE_URL"] as string | undefined
)?.trim();

/** Inner content for www `#status` — parent supplies the section landmark. */
export function StatusSectionContent() {
  const [state, setState] = useState<HealthState>({ kind: "loading" });

  async function refresh() {
    setState({ kind: "loading" });
    const checkedAt = new Date().toISOString();
    try {
      const data = await fetchPublicHealth();
      if (data.status !== "ok") {
        setState({
          kind: "error",
          message: `סטטוס לא צפוי: ${data.status}`,
          checkedAt,
        });
        return;
      }
      setState({ kind: "ok", data, checkedAt });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "בדיקת health נכשלה",
        checkedAt,
      });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <>
      <p className="eyebrow">זמינות</p>
      <h2 id="status-title">סטטוס API חי</h2>
      <p className="section__lead">
        בדיקה ישירה מול <code>GET /v1/health</code> של פריסת המערכת הזו — לא
        דף סטטוס של ספק חוץ־ארגוני, ולא מצג זמינות היסטורי.
      </p>

      <div className="status-card" role="status" aria-live="polite">
        {state.kind === "loading" ? (
          <p className="status-card__state">בודקים…</p>
        ) : null}
        {state.kind === "ok" ? (
          <>
            <p className="status-card__badge status-card__badge--ok">תקין</p>
            <dl className="status-card__meta">
              <div>
                <dt>שירות</dt>
                <dd>{state.data.service}</dd>
              </div>
              <div>
                <dt>גרסה</dt>
                <dd>{state.data.version}</dd>
              </div>
              <div>
                <dt>נבדק</dt>
                <dd>
                  <time dateTime={state.checkedAt}>
                    {new Date(state.checkedAt).toLocaleString("he-IL")}
                  </time>
                </dd>
              </div>
            </dl>
          </>
        ) : null}
        {state.kind === "error" ? (
          <>
            <p className="status-card__badge status-card__badge--err">לא זמין</p>
            <p className="status-card__msg">{state.message}</p>
            <p className="status-card__hint">
              נבדק{" "}
              <time dateTime={state.checkedAt}>
                {new Date(state.checkedAt).toLocaleString("he-IL")}
              </time>
            </p>
          </>
        ) : null}
        <button
          type="button"
          className="btn btn--ghost status-card__refresh"
          onClick={() => void refresh()}
          disabled={state.kind === "loading"}
        >
          רענון
        </button>
      </div>

      {EXTERNAL_STATUS_PAGE_URL ? (
        <p className="status-note">
          דף סטטוס חיצוני עם היסטוריה:{" "}
          <a
            href={EXTERNAL_STATUS_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            פתיחת דף הסטטוס
          </a>
          .
        </p>
      ) : (
        <p className="status-note">
          לניטור חיצוני רציף (Better Stack / UptimeRobot) ראו את{" "}
          <a href="https://github.com/relaya17/hotelOS-AI/blob/main/docs/deployment/uptime-monitoring.md">
            מדריך ה־uptime
          </a>
          . אפשר להגדיר <code>VITE_STATUS_PAGE_URL</code> כדי להציג קישור לדף
          סטטוס מאוחסן כאן.
        </p>
      )}
    </>
  );
}
