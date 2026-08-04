import { useEffect, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  APP_URLS,
  acceptBriefingRecordingConsent,
  fetchBriefingRoom,
  joinBriefingRoomByInvite,
  leaveBriefingRoom,
  postBriefingMessage,
  readStoredUser,
  type BriefingRoomDetailDto,
  type BriefingRoomKind,
} from "@hotelos/web-client";

const roomKindLabel: Record<BriefingRoomKind, string> = {
  committee: "ועדה",
  training: "הדרכה",
  all_hands: "כולם",
};

export type MeetJoinPageProps = {
  readonly token: string;
  readonly onDone: () => void;
};

export function MeetJoinPage({ token, onDone }: MeetJoinPageProps) {
  const [detail, setDetail] = useState<BriefingRoomDetailDto | null>(null);
  const [message, setMessage] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(false);

  const storedUser = readStoredUser();
  const myAttendance = detail?.attendance.find(
    (item) => item.userId === storedUser?.id,
  );
  const hasRecordingConsent = myAttendance?.recordingConsent === true;
  const roomEnded = detail?.room.status === "ended";
  const latestSummary =
    detail && detail.summaries.length > 0
      ? detail.summaries[detail.summaries.length - 1]
      : null;

  async function reload(roomId: string) {
    const room = await fetchBriefingRoom(roomId);
    setDetail(room);
  }

  useEffect(() => {
    let cancelled = false;
    async function join() {
      setError(undefined);
      try {
        const joined = await joinBriefingRoomByInvite(token);
        if (!cancelled) {
          await reload(joined.room.id);
        }
      } catch (joinError) {
        if (!cancelled) {
          setError(
            joinError instanceof Error ? joinError.message : "הצטרפות נכשלה",
          );
        }
      }
    }
    void join();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onAcceptConsent() {
    if (!detail || !consentChecked) {
      setError("יש לסמן את תיבת האישור לפני המשך");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await acceptBriefingRecordingConsent(detail.room.id);
      await reload(detail.room.id);
    } catch (consentError) {
      setError(
        consentError instanceof Error ? consentError.message : "אישור נכשל",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!detail || !message.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await postBriefingMessage(detail.room.id, message.trim());
      setMessage("");
      await reload(detail.room.id);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "שליחה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function onLeave() {
    if (!detail) return;
    setBusy(true);
    setError(undefined);
    try {
      await leaveBriefingRoom(detail.room.id);
      setLeft(true);
    } catch (leaveError) {
      setError(
        leaveError instanceof Error ? leaveError.message : "יציאה נכשלה",
      );
    } finally {
      setBusy(false);
    }
  }

  if (left) {
    return (
      <main id="main-content" className="meet-join" tabIndex={-1}>
        <p className="hotelos-eyebrow">HotelOS · Work · Meet</p>
        <h1>יצאת מהפגישה</h1>
        <p>תודה על ההשתתפות. ניתן לחזור לעבודה הרגילה.</p>
        <Button type="button" onClick={onDone}>
          חזרה ל־Work
        </Button>
        <style>{meetJoinStyles}</style>
      </main>
    );
  }

  return (
    <main id="main-content" className="meet-join" tabIndex={-1}>
      <header className="meet-join__head">
        <div>
          <p className="hotelos-eyebrow">HotelOS · Work · Meet</p>
          <h1>{detail?.room.title ?? "מצטרפ/ת לפגישה…"}</h1>
          {detail ? (
            <p className="meet-join__meta">
              <span className="kind-badge">
                {roomKindLabel[detail.room.roomKind]}
              </span>
              {" · "}
              {roomEnded ? "הפגישה הסתיימה" : "פגישה פעילה"}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || !detail}
          onClick={() => {
            void onLeave();
          }}
        >
          יציאה מהפגישה
        </Button>
      </header>

      {error ? (
        <p className="meet-join__error" role="alert">
          {error}
        </p>
      ) : null}

      {!hasRecordingConsent && detail && !roomEnded ? (
        <section
          className="consent-gate"
          aria-labelledby="work-consent-title"
        >
          <h2 id="work-consent-title">אישור הקלטה</h2>
          <p>
            הפגישה עשויה להיות מוקלטת. יש לאשר את מדיניות HotelOS Meet (
            {detail.room.policyVersion}).
          </p>
          <label className="consent-check">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
            />
            <span>
              קראתי את{" "}
              <a
                href={APP_URLS.legal("meetings")}
                target="_blank"
                rel="noopener noreferrer"
              >
                מדיניות פגישות והקלטות
              </a>
            </span>
          </label>
          <Button
            type="button"
            disabled={busy || !consentChecked}
            onClick={() => {
              void onAcceptConsent();
            }}
          >
            מאשר/ת הקלטה לפי מדיניות meetings.2026.1
          </Button>
        </section>
      ) : null}

      {latestSummary ? (
        <section className="meet-join__card" aria-labelledby="summary-title">
          <h2 id="summary-title">סיכום פגישה</h2>
          <p>{latestSummary.summaryHe}</p>
          {latestSummary.decisions.length > 0 ? (
            <ul>
              {latestSummary.decisions.map((decision) => (
                <li key={decision}>{decision}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {detail && detail.goals.length > 0 ? (
        <section className="meet-join__card" aria-labelledby="goals-title">
          <h2 id="goals-title">יעדים</h2>
          <ul className="goals">
            {detail.goals.map((goal) => (
              <li key={goal.id}>
                <strong>{goal.title}</strong>
                {goal.description ? <p>{goal.description}</p> : null}
                <span>
                  {goal.ownerDisplayName} · {goal.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="meet-join__card" aria-labelledby="chat-title">
        <h2 id="chat-title">צ׳אט החדר</h2>
        <ul className="messages" aria-live="polite">
          {(detail?.messages ?? []).length === 0 ? (
            <li className="empty">אין הודעות עדיין</li>
          ) : (
            detail?.messages.map((item) => (
              <li
                key={item.id}
                className={
                  item.speakerKind === "agent" ? "msg msg--agent" : "msg"
                }
              >
                <strong>{item.speakerName}</strong>
                <p>{item.body}</p>
              </li>
            ))
          )}
        </ul>
        {!roomEnded ? (
          <form className="meet-join__form" onSubmit={onSendMessage}>
            <TextField
              label="הודעה"
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <Button type="submit" disabled={busy || !message.trim() || !detail}>
              שלח
            </Button>
          </form>
        ) : null}
      </section>

      <p className="meet-join__policy">
        <a
          href={APP_URLS.legal("meetings")}
          target="_blank"
          rel="noopener noreferrer"
        >
          מדיניות פגישות והקלטות
        </a>
      </p>

      <style>{meetJoinStyles}</style>
    </main>
  );
}

const meetJoinStyles = `
  .meet-join {
    max-width: 42rem;
    width: 100%;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 1.75rem);
    padding-bottom: clamp(4.5rem, 10vw, 6rem);
    display: grid;
    gap: var(--space-4);
    animation: hotelos-enter var(--motion-med) var(--ease-out) both;
  }
  .meet-join__head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-3);
    align-items: start;
  }
  .meet-join h1 {
    margin: 0;
    font-size: clamp(1.4rem, 3vw, 1.9rem);
    color: var(--color-sea-deep);
  }
  .meet-join__meta {
    margin: var(--space-2) 0 0;
    color: var(--color-ink-soft);
    font-size: var(--text-small);
    font-weight: 500;
  }
  .kind-badge {
    font-size: .75rem;
    font-weight: 700;
    padding: .15rem .5rem;
    border-radius: 999px;
    background: rgb(15 106 92 / 12%);
    color: var(--color-sea-deep);
  }
  .meet-join__error {
    color: var(--color-danger);
    font-weight: 600;
    margin: 0;
  }
  .consent-gate {
    background: rgb(180 83 9 / 8%);
    border: 1px solid rgb(180 83 9 / 25%);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: grid;
    gap: var(--space-3);
  }
  .consent-gate h2 { margin: 0; font-size: 1.05rem; }
  .consent-gate p { margin: 0; color: var(--color-ink-soft); font-size: var(--text-small); }
  .consent-check {
    display: flex;
    gap: var(--space-2);
    align-items: flex-start;
    cursor: pointer;
  }
  .consent-check input { margin-top: .25rem; }
  .meet-join__card {
    background: var(--color-paper-elevated);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    padding: clamp(1rem, 2.5vw, 1.4rem);
    box-shadow: var(--shadow-soft);
    display: grid;
    gap: var(--space-3);
  }
  .meet-join__card h2 { margin: 0; font-size: 1.05rem; }
  .meet-join__card p { margin: 0; color: var(--color-ink-soft); line-height: 1.6; }
  .meet-join__card ul { margin: 0; padding-inline-start: 1.25rem; }
  .goals, .messages {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
  }
  .goals li, .msg {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid rgb(16 36 31 / 8%);
    background: var(--color-paper);
  }
  .goals p, .msg p {
    margin: .25rem 0 0;
    font-size: var(--text-small);
    color: var(--color-ink-soft);
  }
  .goals span { font-size: var(--text-small); color: var(--color-ink-soft); }
  .msg--agent { border-color: rgb(15 106 92 / 28%); background: rgb(15 106 92 / 8%); }
  .empty { color: var(--color-ink-soft); }
  .meet-join__form { display: grid; gap: var(--space-3); }
  .meet-join__policy {
    margin: 0;
    font-size: var(--text-small);
    text-align: center;
  }
  .meet-join__policy a { color: var(--color-sea-deep); font-weight: 600; }
  @media (max-width: 640px) {
    .meet-join__head { flex-direction: column; }
  }
`;
