import { useEffect, useState, type FormEvent } from "react";
import { LOCALE_META, tUi, type LocaleCode } from "@hotelos/i18n";
import { Button, TextField } from "@hotelos/ui";
import {
  fetchStaffChat,
  postStaffChatInstruction,
  type StaffChatMessageDto,
} from "@hotelos/web-client";

export type TurboChatPageProps = {
  readonly locale: LocaleCode;
};

const QUICK = [
  "נקו את החדר 102 לפני הצ׳ק־אין",
  "בדקו את תזרים המזומנים של הרשת להיום",
  "פתחו את ועדת הכספים עם סוכן הכספים",
  "עדכנו סטטוס חדר dirty לניקיון מיידי",
] as const;

export function TurboChatPage({ locale }: TurboChatPageProps) {
  const [messages, setMessages] = useState<readonly StaffChatMessageDto[]>([]);
  const [body, setBody] = useState<string>(QUICK[0]);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | undefined>();

  async function reload() {
    const data = await fetchStaffChat("ops", locale);
    setMessages(data.messages);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await reload();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Load failed",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await postStaffChatInstruction({ body, sourceLocale: "he" });
      await reload();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Send failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Turbo OS · Workforce</p>
        <h1>{tUi(locale, "chat.title")}</h1>
        <p className="sub">{tUi(locale, "chat.sourceHint")}</p>
        <p className="langs">
          {LOCALE_META.map((item) => item.nativeName).join(" · ")}
        </p>
      </header>

      <section className="card">
        <form className="form" onSubmit={onSubmit}>
          <TextField
            label="הוראה (מקור בעברית)"
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />
          <div className="quick">
            {QUICK.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setBody(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {error !== undefined ? (
            <p className="err" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={busy}>
            {tUi(locale, "chat.send")}
          </Button>
        </form>
      </section>

      <section className="card">
        <h2>Inbox</h2>
        <ul className="msgs">
          {messages.map((message) => (
            <li key={message.id}>
              <div className="row">
                <strong>{message.authorName}</strong>
                <span
                  className={
                    message.verification === "verified"
                      ? "badge badge--ok"
                      : "badge"
                  }
                >
                  {message.verification}
                </span>
              </div>
              <p className="source">Source ({message.sourceLocale}): {message.sourceBody}</p>
              <p className="viewer">
                You see ({locale}): {message.bodyForViewer}
              </p>
              <button
                type="button"
                className="linkish"
                onClick={() =>
                  setExpandedId((prev) =>
                    prev === message.id ? undefined : message.id,
                  )
                }
              >
                {expandedId === message.id
                  ? "Hide per-employee delivery"
                  : "Show how each employee receives it"}
              </button>
              {expandedId === message.id ? (
                <ul className="deliveries">
                  {message.deliveries.map((delivery) => (
                    <li key={delivery.employeeId}>
                      <strong>
                        {delivery.displayName} · {delivery.preferredLocale}
                      </strong>
                      <span>{delivery.body}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <style>{`
        .page{display:grid;gap:var(--space-4)}
        .eyebrow{margin:0 0 var(--space-2);letter-spacing:.08em;text-transform:uppercase;font-size:var(--text-small);color:var(--color-sea-deep);font-weight:700}
        h1{margin:0;font-size:clamp(1.8rem,3vw,2.6rem)}
        .sub,.langs{margin:var(--space-2) 0 0;color:var(--color-ink-soft)}
        .langs{font-size:var(--text-small)}
        .card{background:rgb(255 250 242 / 92%);border:1px solid rgb(16 36 31 / 10%);border-radius:var(--radius-md);padding:var(--space-4);box-shadow:var(--shadow-soft)}
        .form{display:grid;gap:var(--space-3)}
        .quick{display:flex;flex-wrap:wrap;gap:var(--space-2)}
        .quick button{font:inherit;font-size:.8rem;border:1px solid rgb(15 106 92 / 25%);background:rgb(15 106 92 / 8%);border-radius:var(--radius-sm);padding:.4rem .6rem;cursor:pointer;text-align:start}
        .msgs{list-style:none;margin:0;padding:0;display:grid;gap:var(--space-3)}
        .msgs > li{padding:var(--space-3);border:1px solid rgb(16 36 31 / 8%);border-radius:var(--radius-sm);background:var(--color-paper-elevated);display:grid;gap:var(--space-2)}
        .row{display:flex;justify-content:space-between;gap:var(--space-2);align-items:center}
        .badge{font-size:.75rem;font-weight:700;padding:.2rem .5rem;border-radius:999px;background:rgb(138 90 18 / 12%);color:#8a5a12}
        .badge--ok{background:rgb(15 106 92 / 12%);color:var(--color-sea-deep)}
        .source,.viewer{margin:0;font-size:var(--text-small);color:var(--color-ink-soft)}
        .viewer{color:var(--color-ink);font-weight:600}
        .linkish{border:0;background:none;color:var(--color-sea-deep);font:inherit;font-weight:700;cursor:pointer;padding:0;text-align:start}
        .deliveries{list-style:none;margin:0;padding:0;display:grid;gap:var(--space-2)}
        .deliveries li{display:grid;gap:.15rem;padding:var(--space-2);background:rgb(15 106 92 / 6%);border-radius:var(--radius-sm)}
        .deliveries span{font-size:var(--text-small);color:var(--color-ink-soft)}
        .err{color:var(--color-danger);margin:0}
      `}</style>
    </div>
  );
}
