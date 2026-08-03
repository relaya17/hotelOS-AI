import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, TextField } from "@hotelos/ui";
import {
  APP_URLS,
  acceptBriefingRecordingConsent,
  briefingRecordingMediaUrl,
  completeBriefingRecording,
  consultBriefingAgent,
  createBriefingGoal,
  endBriefingRoom,
  fetchBriefingRoom,
  joinBriefingRoomByInvite,
  listAgents,
  postBriefingMessage,
  readAccessToken,
  readStoredUser,
  shareAgentToBriefingRoom,
  startBriefingRecording,
  startBriefingRoom,
  updateBriefingGoalStatus,
  type AgentDto,
  type BriefingGoalDto,
  type BriefingRecordingDto,
  type BriefingRoomDetailDto,
  type BriefingRoomKind,
  type EndBriefingRoomResultDto,
} from "@hotelos/web-client";

const MEETING_SECRETARY_AGENT_ID = "agent.meeting_secretary";

const roomKindLabel: Record<BriefingRoomKind, string> = {
  committee: "ועדה",
  training: "הדרכה",
  all_hands: "כולם",
};

export type BriefingMeetPageProps = {
  readonly roomId: string;
  readonly onBack: () => void;
};

export function BriefingMeetPage({ roomId, onBack }: BriefingMeetPageProps) {
  const [detail, setDetail] = useState<BriefingRoomDetailDto | null>(null);
  const [agents, setAgents] = useState<readonly AgentDto[]>([]);
  const [agentToShare, setAgentToShare] = useState("");
  const [message, setMessage] = useState("");
  const [prompt, setPrompt] = useState("מה מצב התזרים והתפוסה ברשת?");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [endResult, setEndResult] = useState<EndBriefingRoomResultDto | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(
    null,
  );
  const [playbackUrl, setPlaybackUrl] = useState<string | undefined>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);

  const storedUser = readStoredUser();
  const myAttendance = detail?.attendance.find(
    (item) => item.userId === storedUser?.id,
  );
  const hasRecordingConsent = myAttendance?.recordingConsent === true;
  const latestSummary =
    detail && detail.summaries.length > 0
      ? detail.summaries[detail.summaries.length - 1]
      : null;
  const roomEnded = detail?.room.status === "ended";

  async function reload() {
    const [room, catalog] = await Promise.all([
      fetchBriefingRoom(roomId),
      listAgents(),
    ]);
    setDetail(room);
    setAgents(catalog);
    const sharedIds = new Set(room.sharedAgents.map((item) => item.agentId));
    if (
      room.room.roomKind === "training" &&
      !sharedIds.has(MEETING_SECRETARY_AGENT_ID)
    ) {
      const secretary = catalog.find(
        (agent) => agent.id === MEETING_SECRETARY_AGENT_ID,
      );
      if (secretary) {
        setAgentToShare(secretary.id);
        return;
      }
    }
    const firstAvailable = catalog.find((agent) => !sharedIds.has(agent.id));
    setAgentToShare(firstAvailable?.id ?? "");
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setError(undefined);
      try {
        await startBriefingRoom(roomId);
        const initial = await fetchBriefingRoom(roomId);
        if (!cancelled && initial.room.inviteToken) {
          await joinBriefingRoomByInvite(initial.room.inviteToken);
        }
        if (!cancelled) await reload();
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "שגיאה בטעינת החדר",
          );
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    let active = true;
    async function enableCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        try {
          const videoOnly = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          if (!active) {
            videoOnly.getTracks().forEach((track) => track.stop());
            return;
          }
          streamRef.current = videoOnly;
          if (videoRef.current) {
            videoRef.current.srcObject = videoOnly;
          }
        } catch {
          // Camera optional
        }
      }
    }
    void enableCamera();
    return () => {
      active = false;
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
    };
  }, []);

  async function onAcceptConsent() {
    if (!consentChecked) {
      setError("יש לסמן את תיבת האישור לפני המשך");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await acceptBriefingRecordingConsent(roomId);
      await reload();
    } catch (consentError) {
      setError(
        consentError instanceof Error ? consentError.message : "אישור נכשל",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onShareAgent(event: FormEvent) {
    event.preventDefault();
    if (!agentToShare) return;
    setBusy(true);
    setError(undefined);
    try {
      await shareAgentToBriefingRoom(roomId, agentToShare);
      await reload();
    } catch (shareError) {
      setError(
        shareError instanceof Error ? shareError.message : "שיתוף נכשל",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await postBriefingMessage(roomId, message.trim());
      setMessage("");
      await reload();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "שליחה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function onAddGoal(event: FormEvent) {
    event.preventDefault();
    if (!goalTitle.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      await createBriefingGoal(roomId, {
        title: goalTitle.trim(),
        description: goalDescription.trim(),
      });
      setGoalTitle("");
      setGoalDescription("");
      await reload();
    } catch (goalError) {
      setError(
        goalError instanceof Error ? goalError.message : "יצירת יעד נכשלה",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onGoalStatus(goal: BriefingGoalDto, status: BriefingGoalDto["status"]) {
    setBusy(true);
    setError(undefined);
    try {
      await updateBriefingGoalStatus(roomId, goal.id, status);
      await reload();
    } catch (statusError) {
      setError(
        statusError instanceof Error ? statusError.message : "עדכון יעד נכשל",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onConsult(agentId: string) {
    setBusy(true);
    setError(undefined);
    try {
      await consultBriefingAgent(roomId, agentId, prompt);
      await reload();
    } catch (consultError) {
      setError(
        consultError instanceof Error ? consultError.message : "תדריך נכשל",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onEndMeeting() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await endBriefingRoom(roomId);
      setEndResult(result);
      await reload();
    } catch (endError) {
      setError(
        endError instanceof Error ? endError.message : "סיום פגישה נכשל",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onStartRecording() {
    const stream = streamRef.current;
    if (!stream) {
      setError("אין מצלמה/מיקרופון — אשרו גישה כדי להקליט");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("הדפדפן לא תומך ב־MediaRecorder");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const meta = await startBriefingRecording(roomId);
      setActiveRecordingId(meta.id);
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void finalizeRecording(meta.id, mimeType);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
      await reload();
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "התחלת הקלטה נכשלה",
      );
    } finally {
      setBusy(false);
    }
  }

  function onStopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function finalizeRecording(recordingId: string, mimeType: string) {
    setBusy(true);
    setError(undefined);
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const durationSeconds = Math.round(
        (Date.now() - startedAtRef.current) / 1000,
      );
      await completeBriefingRecording(
        roomId,
        recordingId,
        blob,
        durationSeconds,
      );
      setActiveRecordingId(null);
      await reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "שמירת הקלטה נכשלה",
      );
    } finally {
      setBusy(false);
    }
  }

  async function playRecording(item: BriefingRecordingDto) {
    if (item.status !== "completed") return;
    setError(undefined);
    try {
      const token = readAccessToken();
      if (!token) throw new Error("Missing session");
      const response = await fetch(
        briefingRecordingMediaUrl(roomId, item.id),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error("Failed to load recording media");
      const blob = await response.blob();
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
      setPlaybackUrl(URL.createObjectURL(blob));
    } catch (playError) {
      setError(
        playError instanceof Error ? playError.message : "ניגון נכשל",
      );
    }
  }

  const sharedIds = new Set(detail?.sharedAgents.map((a) => a.agentId) ?? []);
  const availableAgents = agents.filter((agent) => !sharedIds.has(agent.id));
  const recordings = detail?.recordings ?? [];
  const workInviteUrl = detail
    ? `${APP_URLS.work}/?meetInvite=${encodeURIComponent(detail.room.inviteToken)}`
    : "";

  return (
    <div className="meet">
      <header className="meet__top">
        <div>
          <p className="eyebrow">HotelOS Meet · פגישה פנימית</p>
          <h1>{detail?.room.title ?? "חדר בריפינג"}</h1>
          <p className="sub">
            {detail ? (
              <>
                <span className="kind-badge">
                  {roomKindLabel[detail.room.roomKind]}
                </span>
                {" · "}
              </>
            ) : null}
            מנהל אזור + צוותים · שיתוף סוכנים · סטטוס{" "}
            {detail?.room.status ?? "…"}
          </p>
          {detail && !roomEnded ? (
            <p className="invite-line">
              קישור Work:{" "}
              <code>{workInviteUrl}</code>
            </p>
          ) : null}
        </div>
        <div className="top-actions">
          {recording ? (
            <Button type="button" onClick={onStopRecording} disabled={busy}>
              עצור הקלטה
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                void onStartRecording();
              }}
              disabled={busy || !hasRecordingConsent || roomEnded}
              aria-describedby={
                !hasRecordingConsent ? "recording-consent-hint" : undefined
              }
            >
              הקלט פגישה
            </Button>
          )}
          {!roomEnded ? (
            <Button
              type="button"
              onClick={() => {
                void onEndMeeting();
              }}
              disabled={busy}
            >
              סיים פגישה + מזכירה
            </Button>
          ) : null}
          <Button variant="ghost" type="button" onClick={onBack}>
            חזרה לרשימת חדרים
          </Button>
        </div>
      </header>

      {!hasRecordingConsent && !roomEnded ? (
        <section
          className="consent-gate"
          aria-labelledby="consent-gate-title"
          role="region"
        >
          <h2 id="consent-gate-title">אישור הקלטה</h2>
          <p className="hint">
            לפני הקלטת הפגישה יש לאשר את מדיניות HotelOS Meet (
            {detail?.room.policyVersion ?? "meetings.2026.1"}).
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
          <p id="recording-consent-hint" className="sr-only">
            יש לאשר הקלטה לפני לחיצה על הקלט פגישה
          </p>
        </section>
      ) : null}

      {endResult ? (
        <section className="end-result" role="status" aria-live="polite">
          <h2>סיכום פגישה</h2>
          {endResult.idempotent ? (
            <p className="hint">הפגישה כבר הסתיימה — מוצג סיכום קיים.</p>
          ) : null}
          <p>{endResult.summary.summaryHe}</p>
          {endResult.summary.decisions.length > 0 ? (
            <ul>
              {endResult.summary.decisions.map((decision) => (
                <li key={decision}>{decision}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {latestSummary && !endResult ? (
        <section className="summary-panel" aria-labelledby="latest-summary-title">
          <h2 id="latest-summary-title">סיכום אחרון</h2>
          <p>{latestSummary.summaryHe}</p>
        </section>
      ) : null}

      {recording ? (
        <p className="rec-live" role="status">
          ● מקליט… {activeRecordingId ? `ID ${activeRecordingId.slice(0, 8)}` : ""}
        </p>
      ) : null}

      {error !== undefined ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="meet__grid">
        <section className="stage" aria-label="שיחת וידאו פנימית">
          <div className="tiles">
            <article className="tile tile--self">
              <video ref={videoRef} autoPlay muted playsInline />
              <span>את/ה · מצלמה מקומית</span>
            </article>
            {detail?.participants
              .filter((p) => p.roleLabel !== "מארח / מנהל אזור")
              .map((participant) => (
                <article key={participant.id} className="tile">
                  <div className="avatar" aria-hidden>
                    {participant.displayName.slice(0, 1)}
                  </div>
                  <strong>{participant.displayName}</strong>
                  <span>{participant.roleLabel}</span>
                </article>
              ))}
            {detail?.sharedAgents.map((agent) => (
              <article key={agent.id} className="tile tile--agent">
                <div className="avatar avatar--agent" aria-hidden>
                  AI
                </div>
                <strong>{agent.nameHe}</strong>
                <span>סוכן משותף · {agent.autonomyMode}</span>
                <Button
                  type="button"
                  disabled={busy || roomEnded}
                  onClick={() => {
                    void onConsult(agent.agentId);
                  }}
                >
                  בקש תדריך
                </Button>
              </article>
            ))}
          </div>
          {playbackUrl !== undefined ? (
            <div className="playback">
              <h3>ניגון הקלטה שמורה</h3>
              <video src={playbackUrl} controls playsInline>
                <track kind="captions" label="עברית" srcLang="he" default />
              </video>
            </div>
          ) : null}
        </section>

        <aside className="rail">
          <section className="panel" aria-labelledby="attendance-title">
            <h2 id="attendance-title">נוכחות</h2>
            <ul className="attendance">
              {(detail?.attendance ?? []).length === 0 ? (
                <li className="empty">אין משתתפים רשומים</li>
              ) : (
                detail?.attendance.map((item) => (
                  <li key={item.id}>
                    <strong>{item.displayName}</strong>
                    <span>
                      {new Date(item.joinedAt).toLocaleTimeString()}
                      {item.leftAt ? " · יצא/ה" : " · בחדר"}
                    </span>
                    {item.recordingConsent ? (
                      <span className="badge badge--ok">הסכמה להקלטה</span>
                    ) : (
                      <span className="badge">ללא הסכמה</span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="panel" aria-labelledby="goals-title">
            <h2 id="goals-title">יעדים</h2>
            <ul className="goals">
              {(detail?.goals ?? []).length === 0 ? (
                <li className="empty">אין יעדים עדיין</li>
              ) : (
                detail?.goals.map((goal) => (
                  <li key={goal.id}>
                    <strong>{goal.title}</strong>
                    {goal.description ? <p>{goal.description}</p> : null}
                    <span>
                      {goal.ownerDisplayName} · {goal.status}
                    </span>
                    {!roomEnded && goal.status === "open" ? (
                      <div className="goal-actions">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            void onGoalStatus(goal, "done");
                          }}
                        >
                          סומן כבוצע
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            void onGoalStatus(goal, "cancelled");
                          }}
                        >
                          ביטול
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            {!roomEnded ? (
              <form className="stack" onSubmit={onAddGoal}>
                <TextField
                  label="יעד חדש"
                  name="goalTitle"
                  value={goalTitle}
                  onChange={(event) => setGoalTitle(event.target.value)}
                  required
                />
                <TextField
                  label="תיאור (אופציונלי)"
                  name="goalDescription"
                  value={goalDescription}
                  onChange={(event) => setGoalDescription(event.target.value)}
                />
                <Button type="submit" disabled={busy || !goalTitle.trim()}>
                  הוסף יעד
                </Button>
              </form>
            ) : null}
          </section>

          <section className="panel">
            <h2>הקלטות שמורות</h2>
            <p className="hint">
              קבצים בנתיב מופרד: recordings / tenant / chain / room · מטא־דאטה
              ותמלול החדר נשמרים ב־DB
            </p>
            <ul className="recs">
              {recordings.length === 0 ? (
                <li className="empty">אין הקלטות עדיין</li>
              ) : (
                recordings.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.status}</strong>
                      <span>
                        {new Date(item.startedAt).toLocaleString()}
                        {item.durationSeconds !== null
                          ? ` · ${item.durationSeconds}s`
                          : ""}
                        {item.byteSize !== null
                          ? ` · ${Math.round(item.byteSize / 1024)} KB`
                          : ""}
                      </span>
                      {item.storageKey ? (
                        <span className="key">{item.storageKey}</span>
                      ) : null}
                    </div>
                    {item.status === "completed" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          void playRecording(item);
                        }}
                      >
                        נגן
                      </Button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="panel">
            <h2>שתף סוכן לחדר</h2>
            <p className="hint">
              {detail?.room.roomKind === "training"
                ? "בהדרכות מומלץ לשתף את מזכירת הפגישות (meeting_secretary)."
                : "כמו בוועדת כספים — מזמינים סוכן קיים (CFO, Revenue…) לחדר בלבד."}
            </p>
            <form className="stack" onSubmit={onShareAgent}>
              <label className="select-field">
                <span>סוכן מהמערכת</span>
                <select
                  value={agentToShare}
                  onChange={(event) => setAgentToShare(event.target.value)}
                  aria-label="בחירת סוכן לשיתוף"
                >
                  {availableAgents.length === 0 ? (
                    <option value="">כל הסוכנים כבר בחדר</option>
                  ) : (
                    availableAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.nameHe} · {agent.domain}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <Button
                type="submit"
                disabled={busy || availableAgents.length === 0 || roomEnded}
              >
                שתף סוכן
              </Button>
            </form>
          </section>

          <section className="panel">
            <h2>שאלה לוועדה / לסוכן</h2>
            <TextField
              label="נושא לתדריך"
              name="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <form className="stack" onSubmit={onSendMessage}>
              <TextField
                label="הודעה בצ׳אט החדר"
                name="message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <Button
                type="submit"
                disabled={busy || !message.trim() || roomEnded}
              >
                שלח לחדר
              </Button>
            </form>
          </section>

          <section className="panel transcript">
            <h2>תמלול / תדריכים</h2>
            <ul>
              {detail?.messages.map((item) => (
                <li
                  key={item.id}
                  className={
                    item.speakerKind === "agent" ? "msg msg--agent" : "msg"
                  }
                >
                  <strong>{item.speakerName}</strong>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <style>{`
        .meet { display:grid; gap:var(--space-5); }
        .meet__top { display:flex; justify-content:space-between; gap:var(--space-4); align-items:start; flex-wrap:wrap; }
        .top-actions { display:flex; gap:var(--space-2); flex-wrap:wrap; }
        .eyebrow { margin:0 0 var(--space-2); letter-spacing:.08em; text-transform:uppercase; font-size:var(--text-small); color:var(--color-sea-deep); font-weight:700; }
        h1 { margin:0; font-size:clamp(1.8rem,3vw,2.6rem); }
        .sub { margin:var(--space-2) 0 0; color:var(--color-ink-soft); }
        .kind-badge { font-size:.75rem; font-weight:700; padding:.15rem .5rem; border-radius:999px; background:rgb(15 106 92 / 12%); color:var(--color-sea-deep); }
        .invite-line { margin:var(--space-2) 0 0; font-size:var(--text-small); color:var(--color-ink-soft); }
        .invite-line code { display:block; margin-top:.25rem; font-size:.68rem; word-break:break-all; font-family:ui-monospace,monospace; }
        .consent-gate { background:rgb(180 83 9 / 8%); border:1px solid rgb(180 83 9 / 25%); border-radius:var(--radius-md); padding:var(--space-4); display:grid; gap:var(--space-3); }
        .consent-gate h2 { margin:0; font-size:1.1rem; }
        .consent-check { display:flex; gap:var(--space-2); align-items:flex-start; cursor:pointer; }
        .consent-check input { margin-top:.25rem; }
        .end-result, .summary-panel { background:var(--color-paper-elevated); border:1px solid var(--color-line); border-radius:var(--radius-md); padding:var(--space-4); }
        .end-result h2, .summary-panel h2 { margin:0 0 var(--space-2); font-size:1.1rem; }
        .end-result ul { margin:var(--space-2) 0 0; padding-inline-start:1.25rem; }
        .rec-live { margin:0; color:#9b2c2c; font-weight:700; }
        .meet__grid { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(280px,.9fr); gap:var(--space-4); align-items:start; }
        .stage { background:linear-gradient(160deg,#0c2f2a,#123f37 55%,#1a4f45); border-radius:calc(var(--radius-md) + .2rem); padding:var(--space-4); min-height:28rem; box-shadow:var(--shadow-soft); display:grid; gap:var(--space-4); }
        .tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:var(--space-3); }
        .tile { background:rgb(255 250 242 / 10%); border:1px solid rgb(255 255 255 / 14%); border-radius:var(--radius-md); padding:var(--space-3); color:#eef8f4; display:grid; gap:var(--space-2); align-content:start; min-height:10rem; }
        .tile--self video { width:100%; height:9rem; object-fit:cover; border-radius:var(--radius-sm); background:#081c19; }
        .tile--self span,.tile span { font-size:var(--text-small); opacity:.85; }
        .tile strong { font-family:var(--font-display); }
        .tile--agent { border-color:rgb(120 220 190 / 45%); background:rgb(20 90 75 / 45%); }
        .avatar { width:3rem; height:3rem; border-radius:999px; display:grid; place-items:center; background:rgb(255 255 255 / 16%); font-weight:700; }
        .avatar--agent { background:rgb(120 220 190 / 28%); }
        .playback { color:#eef8f4; display:grid; gap:var(--space-2); }
        .playback h3 { margin:0; font-size:1rem; }
        .playback video { width:100%; max-height:240px; border-radius:var(--radius-sm); background:#000; }
        .rail { display:grid; gap:var(--space-3); }
        .panel { background:var(--color-paper-elevated); border:1px solid var(--color-line); border-radius:var(--radius-md); padding:var(--space-4); box-shadow:var(--shadow-soft); }
        .panel h2 { margin:0 0 var(--space-2); font-size:1.15rem; }
        .hint { margin:0 0 var(--space-3); color:var(--color-ink-soft); font-size:var(--text-small); }
        .stack { display:grid; gap:var(--space-3); margin-top:var(--space-3); }
        .select-field { display:grid; gap:var(--space-2); }
        .select-field span { font-size:var(--text-small); font-weight:600; color:var(--color-ink-soft); }
        .select-field select { font:inherit; border:1px solid var(--color-line-strong); border-radius:var(--radius-sm); padding:.85rem .95rem; background:var(--color-paper-elevated); }
        .attendance, .goals, .recs { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-2); }
        .attendance li, .goals li, .recs li { padding:var(--space-3); border-radius:var(--radius-sm); background:var(--color-paper-elevated); border:1px solid rgb(16 36 31 / 8%); display:grid; gap:.25rem; }
        .attendance span, .goals span, .recs span { font-size:var(--text-small); color:var(--color-ink-soft); }
        .badge { display:inline-block; font-size:.7rem; font-weight:700; padding:.15rem .45rem; border-radius:999px; background:rgb(16 36 31 / 8%); }
        .badge--ok { background:rgb(15 106 92 / 15%); color:var(--color-sea-deep); }
        .goals p { margin:0; font-size:var(--text-small); color:var(--color-ink-soft); }
        .goal-actions { display:flex; flex-wrap:wrap; gap:var(--space-2); }
        .recs li { flex-direction:row; justify-content:space-between; align-items:start; }
        .recs li > div { display:grid; gap:.2rem; }
        .recs .key { font-family:ui-monospace,monospace; font-size:.7rem; word-break:break-all; }
        .empty { color:var(--color-ink-soft); }
        .transcript ul { list-style:none; margin:0; padding:0; display:grid; gap:var(--space-3); max-height:22rem; overflow:auto; }
        .msg { padding:var(--space-3); border-radius:var(--radius-sm); background:var(--color-paper-elevated); border:1px solid rgb(16 36 31 / 8%); }
        .msg--agent { border-color:rgb(15 106 92 / 28%); background:rgb(15 106 92 / 8%); }
        .msg strong { display:block; margin-bottom:.35rem; }
        .msg p { margin:0; white-space:pre-wrap; color:var(--color-ink-soft); font-size:var(--text-small); }
        .state--error { color:var(--color-danger); }
        .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
        @media (max-width:980px){ .meet__grid{ grid-template-columns:1fr; } .meet__top{ flex-direction:column; } }
      `}</style>
    </div>
  );
}
